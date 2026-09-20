import { openDB } from "idb";

const DB_NAME = "private-chat-db";
const DB_VERSION = 2;
const STORE_NAME = "outbox";

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, {
        keyPath: "clientMessageId"
      });

      store.createIndex("createdAt", "createdAt");
    }
  }
});

export async function enqueueMessage(message) {
  const db = await dbPromise;

  await db.put(STORE_NAME, {
    ...message,
    status: "queued",
    createdAt: Date.now()
  });
}

export async function getQueuedMessages(
  username
) {
  const db = await dbPromise;

  const messages = await db.getAllFromIndex(
    STORE_NAME,
    "createdAt"
  );

  return messages.filter(
    (message) =>
      message.senderName === username
  );
}

export async function removeQueuedMessage(
  clientMessageId
) {
  const db = await dbPromise;

  await db.delete(
    STORE_NAME,
    clientMessageId
  );
}

export async function updateQueuedMessage(
  clientMessageId,
  changes
) {
  const db = await dbPromise;

  const existing = await db.get(
    STORE_NAME,
    clientMessageId
  );

  if (!existing) {
    return;
  }

  await db.put(STORE_NAME, {
    ...existing,
    ...changes
  });
}