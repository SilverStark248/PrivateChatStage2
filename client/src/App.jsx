import { useEffect, useRef, useState } from "react";
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from "@microsoft/signalr";

import {
  enqueueMessage,
  getQueuedMessages,
  removeQueuedMessage,
  updateQueuedMessage
} from "./messageQueue";

const API_BASE = "https://privatechatstage2.onrender.com";
const HUB_URL = `${API_BASE}/chatHub`;

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function App() {
  const [username, setUsername] = useState(
    () =>
    sessionStorage.getItem(
      "private_chat_username"
    ) || ""
  );
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState(
    () => sessionStorage.getItem("private_chat_token") || ""
  );
  
  const [loggedIn, setLoggedIn] = useState(
    () => !!sessionStorage.getItem("private_chat_token")
  );

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [connectionStatus, setConnectionStatus] =
    useState("Disconnected");
  const [error, setError] = useState("");

  const connectionRef = useRef(null);
  const bottomRef = useRef(null);

  async function flushQueue(connection) {
    if (
      !connection ||
      connection.state !== HubConnectionState.Connected
    ) {
      return;
    }

    const queuedMessages = await getQueuedMessages();

    for (const queuedMessage of queuedMessages) {
      try {
        setMessages((current) =>
          current.map((message) =>
            message.messageId ===
            queuedMessage.clientMessageId
              ? {
                  ...message,
                  deliveryStatus: "sending"
                }
              : message
          )
        );

        await updateQueuedMessage(
          queuedMessage.clientMessageId,
          {
            status: "sending"
          }
        );

        await connection.invoke(
          "SendMessage",
          queuedMessage.clientMessageId,
          queuedMessage.text
        );

        await removeQueuedMessage(
          queuedMessage.clientMessageId
        );

        setMessages((current) =>
          current.map((message) =>
            message.messageId ===
            queuedMessage.clientMessageId
              ? {
                  ...message,
                  deliveryStatus: "sent"
                }
              : message
          )
        );
      } catch (err) {
        console.error(
          "Queued message could not be sent:",
          err
        );

        await updateQueuedMessage(
          queuedMessage.clientMessageId,
          {
            status: "queued"
          }
        ).catch(() => {});

        setMessages((current) =>
          current.map((message) =>
            message.messageId ===
            queuedMessage.clientMessageId
              ? {
                  ...message,
                  deliveryStatus: "queued"
                }
              : message
          )
        );

        break;
      }
    }
  }

  async function loadHistory(connection) {
    try {
      const history = await connection.invoke(
        "GetHistory",
        100
      );

      const queuedMessages =
        await getQueuedMessages();

      const localQueuedMessages =
        queuedMessages.map((message) => ({
          messageId:
            message.clientMessageId,
          roomId: "our-private-room",
          senderName: username,
          text: message.text,
          sentAtUtc: new Date(
            message.createdAt
          ).toISOString(),
          deliveryStatus:
            message.status === "sending"
              ? "sending"
              : "queued"
        }));

      const historyIds = new Set(
        history.map(
          (message) => message.messageId
        )
      );

      const stillQueued =
        localQueuedMessages.filter(
          (message) =>
            !historyIds.has(
              message.messageId
            )
        );

      setMessages([
        ...history,
        ...stillQueued
      ]);
    } catch (err) {
      console.error(err);

      setError(
        "Could not load message history."
      );
    }
  }

  useEffect(() => {
    if (!loggedIn || !accessToken) {
      return;
    }

    let connection;

    async function start() {
      connection = new HubConnectionBuilder()
        .withUrl(HUB_URL, {
          accessTokenFactory: () => accessToken
        })
        .withAutomaticReconnect([
          0,
          1000,
          3000,
          5000,
          10000
        ])
        .configureLogging(LogLevel.Warning)
        .build();

      connection.onreconnecting(() => {
        setConnectionStatus("Reconnecting...");
      });

      connection.onreconnected(async () => {
        setConnectionStatus("Connected");

        await loadHistory(connection);
        await flushQueue(connection);
      });

      connection.onclose(() => {
        setConnectionStatus("Disconnected");
      });

      connection.on(
        "ReceiveMessage",
        (message) => {
          setMessages((current) => {
            if (
              current.some(
                (item) =>
                  item.messageId ===
                  message.messageId
              )
            ) {
              return current;
            }

            return [...current, message];
          });
        }
      );

      connectionRef.current = connection;

      try {
        setConnectionStatus("Connecting...");

        await connection.start();

        setConnectionStatus("Connected");

        await loadHistory(connection);
        await flushQueue(connection);
      } catch (err) {
        console.error(err);

        setConnectionStatus(
          "Connection failed"
        );

        setError(
          "Could not connect to the private chat server."
        );
      }
    }

    start();

    return () => {
      if (connection) {
        connection.stop();
      }

      connectionRef.current = null;
    };
  }, [loggedIn, accessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  async function login(event) {
    event.preventDefault();

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError(
        "Username and password are required."
      );

      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_BASE}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: cleanUsername,
            password
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Invalid username or password."
        );

        return;
      }

      setUsername(
        data.username || cleanUsername
      );
      
      setPassword("");
      
      sessionStorage.setItem(
        "private_chat_token",
        data.token
      );
      
      sessionStorage.setItem(
        "private_chat_username",
        data.username || cleanUsername
      );
      
      setAccessToken(data.token);
      setLoggedIn(true);
    }
    catch (err) {
      console.error(err);
      setError(
        "Could not reach the private chat server."
      );
    }
  }

  async function logout() {
    const connection = connectionRef.current;
    
    if (connection) {
      await connection.stop();
    }
    
    connectionRef.current = null;
    
    sessionStorage.removeItem(
      "private_chat_token"
    );
    
    sessionStorage.removeItem(
      "private_chat_username"
    );
    
    setAccessToken("");
    setLoggedIn(false);
    setUsername("");
    setPassword("");
    setMessages([]);
    setText("");
    setConnectionStatus("Disconnected");
    setError("");
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    const clientMessageId =
      crypto.randomUUID();

    const queuedMessage = {
      clientMessageId,
      text: cleanText
    };

    try {
      await enqueueMessage(
        queuedMessage
      );
    } catch (err) {
      console.error(
        "Could not save message locally:",
        err
      );

      setError(
        "Could not save the message locally."
      );

      return;
    }

    const localMessage = {
      messageId: clientMessageId,
      roomId: "our-private-room",
      senderName: username,
      text: cleanText,
      sentAtUtc: new Date().toISOString(),
      deliveryStatus: "queued"
    };

    setMessages((current) => [
      ...current,
      localMessage
    ]);

    setText("");
    setError("");

    const connection = connectionRef.current;

    if (
      !connection ||
      connection.state !==
        HubConnectionState.Connected
    ) {
      setError(
        "You're offline. Your message is safely queued and will be sent when the connection returns."
      );

      return;
    }

    await flushQueue(connection);
  }

  if (!loggedIn) {
    return (
      <main className="landing">
        <div
          className="grain"
          aria-hidden="true"
        />

        <section className="welcome-card">
          <div className="monogram">
            JMO
          </div>

          <p className="eyebrow">
            A private cinematic corner
          </p>

          <h1>Our Little Corner</h1>

          <div className="title-line" />

          <p className="subtitle">
            A private place for two — wrapped
            in a dark, elegant aesthetic
            inspired by the cinematic style
            of Jenna Marie Ortega.
          </p>

          <div className="quote">
            <span>“</span>
            Two people. One little corner of
            the internet.
            <span>”</span>
          </div>

          <form
            onSubmit={login}
            className="join-form"
          >
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="Enter your username"
              maxLength={50}
              autoComplete="username"
            />

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
            />

            <button type="submit">
              Enter our space <span>→</span>
            </button>
          </form>

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          <p className="development-note">
            Private Stage 2 build · Weak-network
            protection
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="chat-page">
      <div
        className="grain"
        aria-hidden="true"
      />

      <section className="chat-shell">
        <header className="chat-header">
          <div className="brand">
            <div className="mini-monogram">
              JMO
            </div>

            <div>
              <p className="eyebrow">
                Private room · for two
              </p>

              <h1>
                Our Little Corner
              </h1>
            </div>
          </div>

          <div className="connection">
            <span
              className={`status-dot ${
                connectionStatus ===
                "Connected"
                  ? "online"
                  : ""
              }`}
            />

            {connectionStatus}

            <button
              type="button"
              onClick={logout}
              className="logout-button"
            >
              Leave
            </button>
          </div>
        </header>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-mark">
                ✦
              </div>

              <h2>
                The scene is yours
              </h2>

              <p>
                Start the conversation.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const mine =
                message.senderName ===
                username;

              return (
                <div
                  key={message.messageId}
                  className={`message-row ${
                    mine
                      ? "mine"
                      : "theirs"
                  }`}
                >
                  <article className="message-bubble">
                    {!mine && (
                      <div className="sender">
                        {message.senderName}
                      </div>
                    )}

                    <div>
                      {message.text}
                    </div>

                    <time>
                      {message.deliveryStatus ===
                        "queued" &&
                        "Queued · "}

                      {message.deliveryStatus ===
                        "sending" &&
                        "Sending · "}

                      {formatTime(
                        message.sentAtUtc
                      )}
                    </time>
                  </article>
                </div>
              );
            })
          )}

          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="chat-error">
            {error}
          </div>
        )}

        <form
          className="composer"
          onSubmit={sendMessage}
        >
          <input
            value={text}
            onChange={(e) =>
              setText(e.target.value)
            }
            placeholder="Write something..."
            maxLength={4000}
          />

          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send message"
          >
            →
          </button>
        </form>
      </section>
    </main>
  );
}