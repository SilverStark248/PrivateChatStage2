import { useEffect, useRef, useState } from "react";
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from "@microsoft/signalr";

const API_BASE = "http://localhost:5180";
const HUB_URL = `${API_BASE}/chatHub`;

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [connectionStatus, setConnectionStatus] =
    useState("Disconnected");
  const [error, setError] = useState("");

  const connectionRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!loggedIn || !accessToken) return;

    let connection;

    async function start() {
      connection = new HubConnectionBuilder()
        .withUrl(HUB_URL, {
          accessTokenFactory: () => accessToken
        })
        .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
        .configureLogging(LogLevel.Warning)
        .build();

      connection.onreconnecting(() => {
        setConnectionStatus("Reconnecting...");
      });

      connection.onreconnected(async () => {
        setConnectionStatus("Connected");
        await loadHistory(connection);
      });

      connection.onclose(() => {
        setConnectionStatus("Disconnected");
      });

      connection.on("ReceiveMessage", (message) => {
        setMessages((current) => {
          if (
            current.some(
              (item) => item.messageId === message.messageId
            )
          ) {
            return current;
          }

          return [...current, message];
        });
      });

      connectionRef.current = connection;

      try {
        setConnectionStatus("Connecting...");

        await connection.start();

        setConnectionStatus("Connected");

        await loadHistory(connection);
      } catch (err) {
        console.error(err);
        setConnectionStatus("Connection failed");
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

  async function loadHistory(connection) {
    try {
      const history = await connection.invoke(
        "GetHistory",
        100
      );

      setMessages(history);
    } catch (err) {
      console.error(err);
      setError("Could not load message history.");
    }
  }

  async function login(event) {
    event.preventDefault();

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError("Username and password are required.");
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
          data.message || "Invalid username or password."
        );
        return;
      }

      setUsername(data.username || cleanUsername);
      setPassword("");
      setAccessToken(data.token);
      setLoggedIn(true);
    } catch (err) {
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

    setAccessToken("");
    setLoggedIn(false);
    setPassword("");
    setMessages([]);
    setText("");
    setConnectionStatus("Disconnected");
    setError("");
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanText = text.trim();

    if (!cleanText) return;

    const connection = connectionRef.current;

    if (
      !connection ||
      connection.state !== HubConnectionState.Connected
    ) {
      setError(
        "The connection is currently unavailable. Try again in a moment."
      );
      return;
    }

    try {
      setError("");

      await connection.invoke(
        "SendMessage",
        cleanText
      );

      setText("");
    } catch (err) {
      console.error(err);
      setError("Message could not be sent.");
    }
  }

  if (!loggedIn) {
    return (
      <main className="landing">
        <div className="grain" aria-hidden="true" />

        <section className="welcome-card">
          <div className="monogram">JMO</div>

          <p className="eyebrow">
            A private cinematic corner
          </p>

          <h1>Our Little Corner</h1>

          <div className="title-line" />

          <p className="subtitle">
            A private place for two — wrapped in a dark,
            elegant aesthetic inspired by the cinematic
            style of Jenna Marie Ortega.
          </p>

          <div className="quote">
            <span>“</span>
            Two people. One little corner of the internet.
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
            <p className="error">{error}</p>
          )}

          <p className="development-note">
            Private Stage 1 build · Authenticated chat ·
            Weak-network features coming next
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="chat-page">
      <div className="grain" aria-hidden="true" />

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

              <h1>Our Little Corner</h1>
            </div>
          </div>

          <div className="connection">
            <span
              className={`status-dot ${
                connectionStatus === "Connected"
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

              <h2>The scene is yours</h2>

              <p>
                Start the conversation.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const mine =
                message.senderName === username;

              return (
                <div
                  key={message.messageId}
                  className={`message-row ${
                    mine ? "mine" : "theirs"
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
            disabled={
              connectionStatus !== "Connected"
            }
          />

          <button
            type="submit"
            disabled={
              !text.trim() ||
              connectionStatus !== "Connected"
            }
            aria-label="Send message"
          >
            →
          </button>
        </form>
      </section>
    </main>
  );
}