"use strict";

const ROOM_STORAGE_PREFIX = "cartshare:room:";
const SESSION_STORAGE_KEY = "cartshare:current-session";
const MAX_ACTIVITY_ENTRIES = 100;
const ROOM_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const CURRENCY_FORMATTER = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD"
});

const elements = {
  accessScreen: document.getElementById("access-screen"),
  roomScreen: document.getElementById("room-screen"),
  accessMessage: document.getElementById("access-message"),
  noticeMessage: document.getElementById("notice-message"),
  username: document.getElementById("username"),
  createRoomForm: document.getElementById("create-room-form"),
  joinRoomForm: document.getElementById("join-room-form"),
  roomCodeInput: document.getElementById("room-code-input"),
  roomCodeDisplay: document.getElementById("room-code-display"),
  currentUserDisplay: document.getElementById("current-user-display"),
  leaveRoomButton: document.getElementById("leave-room-button"),
  copyCodeButton: document.getElementById("copy-code-button"),
  roomMessage: document.getElementById("room-message"),
  addItemForm: document.getElementById("add-item-form"),
  itemName: document.getElementById("item-name"),
  itemQuantity: document.getElementById("item-quantity"),
  itemPrice: document.getElementById("item-price"),
  cartMessage: document.getElementById("cart-message"),
  cartItems: document.getElementById("cart-items"),
  cartItemCount: document.getElementById("cart-item-count"),
  cartTotal: document.getElementById("cart-total"),
  activityList: document.getElementById("activity-list"),
  receiptContent: document.getElementById("receipt-content"),
  printReceiptButton: document.getElementById("print-receipt-button")
};

let currentUser = null;
let currentRoomCode = null;
let roomData = null;

function roomStorageKey(roomCode) {
  return `${ROOM_STORAGE_PREFIX}${roomCode}`;
}

function showMessage(element, message, type) {
  element.textContent = message;
  element.classList.remove("d-none", "alert-danger", "alert-info", "alert-success", "alert-warning");
  if (type) {
    element.classList.add(`alert-${type}`);
  }
}

function hideMessage(element) {
  element.textContent = "";
  element.classList.add("d-none");
  element.classList.remove("alert-danger", "alert-info", "alert-success", "alert-warning");
}

function formatMoney(amount) {
  return CURRENCY_FORMATTER.format(amount);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function generateRoomCode() {
  const randomValues = new Uint32Array(6);
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    window.crypto.getRandomValues(randomValues);
    return Array.from(randomValues, (value) => ROOM_CODE_CHARACTERS[value % ROOM_CODE_CHARACTERS.length]).join("");
  }
  return Array.from({ length: 6 }, () => ROOM_CODE_CHARACTERS[Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length)]).join("");
}

function isValidStoredRoom(data, expectedCode) {
  return Boolean(
    data &&
    typeof data === "object" &&
    data.roomCode === expectedCode &&
    Array.isArray(data.items) &&
    Array.isArray(data.activities) &&
    data.items.every((item) =>
      item &&
      typeof item.id === "string" &&
      item.id.length > 0 &&
      typeof item.name === "string" &&
      item.name.trim().length > 0 &&
      Number.isSafeInteger(item.quantity) &&
      item.quantity > 0 &&
      Number.isFinite(item.unitPrice) &&
      item.unitPrice >= 0 &&
      Number.isFinite(item.quantity * item.unitPrice) &&
      typeof item.addedBy === "string"
    ) &&
    new Set(data.items.map((item) => item.id)).size === data.items.length &&
    Number.isFinite(data.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0)) &&
    data.activities.every((activity) =>
      activity &&
      typeof activity.id === "string" &&
      activity.id.length > 0 &&
      typeof activity.name === "string" &&
      activity.name.trim().length > 0 &&
      typeof activity.action === "string" &&
      activity.action.trim().length > 0 &&
      typeof activity.timestamp === "string"
    )
  );
}

function readRoom(roomCode) {
  const storedValue = window.localStorage.getItem(roomStorageKey(roomCode));
  if (storedValue === null) {
    return null;
  }

  let parsedData;
  try {
    parsedData = JSON.parse(storedValue);
  } catch {
    throw new Error("This room's saved data could not be read. Its localStorage entry may be damaged.");
  }

  if (!isValidStoredRoom(parsedData, roomCode)) {
    throw new Error("This room's saved data is incomplete or invalid, so it cannot be opened safely.");
  }
  return parsedData;
}

function writeRoom(data) {
  window.localStorage.setItem(roomStorageKey(data.roomCode), JSON.stringify(data));
}

function recordActivity(data, name, action) {
  data.activities.unshift({
    id: createId(),
    name,
    action,
    timestamp: new Date().toISOString()
  });
  data.activities = data.activities.slice(0, MAX_ACTIVITY_ENTRIES);
}

function mutateRoom(update) {
  if (!currentRoomCode || !roomData) {
    showMessage(elements.accessMessage, "Join or create a room before using the shared cart.", "danger");
    showAccessScreen();
    return false;
  }

  let latestRoom;
  try {
    latestRoom = readRoom(currentRoomCode);
  } catch (error) {
    showMessage(elements.roomMessage, `The latest room data could not be read, so your change was not saved. ${error.message}`, "danger");
    return false;
  }

  if (!latestRoom) {
    showAccessScreen();
    showMessage(elements.accessMessage, "This room is no longer available in this browser. Join or create a room to continue.", "warning");
    return false;
  }

  const updatedRoom = {
    roomCode: latestRoom.roomCode,
    items: latestRoom.items.map((item) => ({ ...item })),
    activities: latestRoom.activities.map((activity) => ({ ...activity }))
  };
  if (update(updatedRoom) === false) {
    roomData = updatedRoom;
    renderRoom();
    return false;
  }

  if (!isValidStoredRoom(updatedRoom, currentRoomCode)) {
    showMessage(elements.roomMessage, "That change would create invalid room data, so it was not saved.", "danger");
    return false;
  }

  try {
    writeRoom(updatedRoom);
  } catch (error) {
    showMessage(elements.roomMessage, `Your change could not be saved in this browser. ${error.message}`, "danger");
    return false;
  }

  roomData = updatedRoom;
  hideMessage(elements.roomMessage);
  renderRoom();
  return true;
}

function getUsername() {
  const name = elements.username.value.trim();
  if (!name || name.length > 40) {
    showMessage(elements.accessMessage, "Please enter a name between 1 and 40 characters before creating or joining a room.", "danger");
    elements.username.focus();
    return null;
  }
  hideMessage(elements.accessMessage);
  hideMessage(elements.noticeMessage);
  return name;
}

function saveCurrentSession(name, roomCode) {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ name, roomCode }));
}

function showRoomScreen() {
  elements.accessScreen.classList.add("d-none");
  elements.roomScreen.classList.remove("d-none");
}

function showAccessScreen() {
  elements.roomScreen.classList.add("d-none");
  elements.accessScreen.classList.remove("d-none");
  currentUser = null;
  currentRoomCode = null;
  roomData = null;
}

function enterRoom(name, roomCode, data) {
  hideMessage(elements.cartMessage);
  currentUser = name;
  currentRoomCode = roomCode;
  roomData = data;
  elements.username.value = name;
  elements.roomCodeDisplay.textContent = roomCode;
  elements.currentUserDisplay.textContent = name;
  showRoomScreen();

  const didRecordJoin = mutateRoom((updatedRoom) => {
    recordActivity(updatedRoom, name, "joined the room");
  });
  if (didRecordJoin) {
    hideMessage(elements.noticeMessage);
  }
}

function createRoom(name) {
  let roomCode;
  let newRoom;
  try {
    do {
      roomCode = generateRoomCode();
    } while (window.localStorage.getItem(roomStorageKey(roomCode)) !== null);

    newRoom = { roomCode, items: [], activities: [] };
    writeRoom(newRoom);
    saveCurrentSession(name, roomCode);
  } catch (error) {
    showMessage(elements.accessMessage, `The room could not be created or saved. ${error.message}`, "danger");
    return;
  }

  enterRoom(name, roomCode, newRoom);
}

function joinRoom(name, roomCode) {
  if (!roomCode) {
    showMessage(elements.accessMessage, "Please enter the six-character room code.", "danger");
    elements.roomCodeInput.focus();
    return;
  }
  if (!ROOM_CODE_PATTERN.test(roomCode)) {
    showMessage(elements.accessMessage, "Room codes must contain exactly six letters or numbers.", "danger");
    elements.roomCodeInput.focus();
    return;
  }

  let existingRoom;
  try {
    existingRoom = readRoom(roomCode);
  } catch (error) {
    showMessage(elements.accessMessage, error.message, "danger");
    return;
  }

  if (!existingRoom) {
    showMessage(elements.accessMessage, "That room code was not found. Check the code and try again.", "danger");
    elements.roomCodeInput.focus();
    return;
  }

  try {
    saveCurrentSession(name, roomCode);
  } catch (error) {
    showMessage(elements.accessMessage, `This browser could not remember your current room. ${error.message}`, "danger");
    return;
  }
  enterRoom(name, roomCode, existingRoom);
}

function renderCart() {
  elements.cartItems.replaceChildren();
  elements.cartItemCount.textContent = `${roomData.items.length} ${roomData.items.length === 1 ? "item" : "items"}`;

  let total = 0;
  if (roomData.items.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "Your cart is empty. Add the first item for your group.";
    elements.cartItems.append(emptyMessage);
  } else {
    roomData.items.forEach((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      total += lineTotal;

      const itemRow = document.createElement("article");
      itemRow.className = "cart-item";
      const itemMain = document.createElement("div");
      itemMain.className = "cart-item-main";
      const itemName = document.createElement("span");
      itemName.className = "cart-item-name";
      itemName.textContent = item.name;
      const itemDetails = document.createElement("div");
      itemDetails.className = "cart-item-details";
      itemDetails.textContent = `Qty ${item.quantity} · ${formatMoney(item.unitPrice)} each · Added by ${item.addedBy}`;
      const itemSide = document.createElement("div");
      itemSide.className = "cart-item-side";
      const itemPrice = document.createElement("span");
      itemPrice.className = "cart-item-price";
      itemPrice.textContent = formatMoney(lineTotal);
      const removeButton = document.createElement("button");
      removeButton.className = "remove-button";
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove ${item.name} from the cart`);
      removeButton.addEventListener("click", () => removeItem(item.id));

      itemMain.append(itemName, itemDetails);
      itemSide.append(itemPrice, removeButton);
      itemRow.append(itemMain, itemSide);
      elements.cartItems.append(itemRow);
    });
  }
  elements.cartTotal.textContent = formatMoney(total);
}

function renderActivity() {
  elements.activityList.replaceChildren();
  if (roomData.activities.length === 0) {
    const emptyEntry = document.createElement("li");
    emptyEntry.className = "empty-state";
    emptyEntry.textContent = "Room activity will appear here.";
    elements.activityList.append(emptyEntry);
    return;
  }

  roomData.activities.forEach((activity) => {
    const entry = document.createElement("li");
    entry.className = "activity-entry";
    const description = document.createElement("div");
    description.className = "activity-text";
    const participant = document.createElement("strong");
    participant.textContent = activity.name;
    description.append(participant, document.createTextNode(` ${activity.action}`));
    const time = document.createElement("time");
    time.className = "activity-time";
    const date = new Date(activity.timestamp);
    if (!Number.isNaN(date.getTime())) {
      time.dateTime = date.toISOString();
      time.textContent = date.toLocaleString();
    } else {
      time.textContent = "Time unavailable";
    }
    entry.append(description, time);
    elements.activityList.append(entry);
  });
}

function renderReceipt() {
  elements.receiptContent.replaceChildren();
  elements.printReceiptButton.disabled = roomData.items.length === 0;

  const title = document.createElement("h3");
  title.className = "receipt-heading";
  title.textContent = "CartShare Receipt";
  const room = document.createElement("p");
  room.className = "receipt-room";
  room.textContent = `Room ${roomData.roomCode}`;
  elements.receiptContent.append(title, room);

  if (roomData.items.length === 0) {
    const emptyText = document.createElement("p");
    emptyText.className = "receipt-empty";
    emptyText.textContent = "Add items to your cart to create a receipt.";
    elements.receiptContent.append(emptyText);
    return;
  }

  let total = 0;
  roomData.items.forEach((item) => {
    const lineTotal = item.quantity * item.unitPrice;
    total += lineTotal;
    const row = document.createElement("div");
    row.className = "receipt-row";
    const itemInfo = document.createElement("div");
    const itemName = document.createElement("span");
    itemName.className = "receipt-item-name";
    itemName.textContent = item.name;
    const itemDetail = document.createElement("span");
    itemDetail.className = "receipt-item-detail";
    itemDetail.textContent = `${item.quantity} × ${formatMoney(item.unitPrice)} · Added by ${item.addedBy}`;
    itemInfo.append(itemName, itemDetail);
    const itemTotal = document.createElement("span");
    itemTotal.className = "receipt-row-total";
    itemTotal.textContent = formatMoney(lineTotal);
    row.append(itemInfo, itemTotal);
    elements.receiptContent.append(row);
  });

  const totalRow = document.createElement("div");
  totalRow.className = "receipt-total";
  const totalLabel = document.createElement("span");
  totalLabel.textContent = "Total";
  const totalAmount = document.createElement("span");
  totalAmount.textContent = formatMoney(total);
  totalRow.append(totalLabel, totalAmount);
  elements.receiptContent.append(totalRow);
}

function renderRoom() {
  if (!roomData || !currentRoomCode || !currentUser) {
    return;
  }
  elements.roomCodeDisplay.textContent = currentRoomCode;
  elements.currentUserDisplay.textContent = currentUser;
  renderCart();
  renderActivity();
  renderReceipt();
}

function addItem(event) {
  event.preventDefault();
  hideMessage(elements.cartMessage);
  if (!currentRoomCode || !roomData) {
    showMessage(elements.accessMessage, "Join or create a room before adding items.", "warning");
    showAccessScreen();
    return;
  }

  const name = elements.itemName.value.trim();
  const quantity = Number(elements.itemQuantity.value);
  const unitPrice = Number(elements.itemPrice.value);
  if (!name || name.length > 80) {
    showMessage(elements.cartMessage, "Please enter an item name between 1 and 80 characters.", null);
    elements.itemName.focus();
    return;
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    showMessage(elements.cartMessage, "Quantity must be a whole number greater than zero.", null);
    elements.itemQuantity.focus();
    return;
  }
  if (
    elements.itemPrice.value.trim() === "" ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0 ||
    elements.itemPrice.validity.stepMismatch
  ) {
    showMessage(elements.cartMessage, "Please enter a valid price of zero or more, using no more than two decimal places.", null);
    elements.itemPrice.focus();
    return;
  }
  const currentTotal = roomData.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  if (!Number.isFinite(quantity * unitPrice) || !Number.isFinite(currentTotal + quantity * unitPrice)) {
    showMessage(elements.cartMessage, "That quantity and price create a total that is too large.", null);
    return;
  }

  const added = mutateRoom((updatedRoom) => {
    updatedRoom.items.unshift({ id: createId(), name, quantity, unitPrice, addedBy: currentUser });
    recordActivity(updatedRoom, currentUser, `added ${name}`);
  });
  if (added) {
    elements.addItemForm.reset();
    elements.itemQuantity.value = "1";
    elements.itemName.focus();
  }
}

function removeItem(itemId) {
  if (!currentRoomCode || !roomData) {
    showMessage(elements.accessMessage, "Join or create a room before changing the cart.", "warning");
    showAccessScreen();
    return;
  }

  const removed = mutateRoom((updatedRoom) => {
    const itemIndex = updatedRoom.items.findIndex((cartItem) => cartItem.id === itemId);
    if (itemIndex === -1) {
      return false;
    }
    const [item] = updatedRoom.items.splice(itemIndex, 1);
    recordActivity(updatedRoom, currentUser, `removed ${item.name}`);
  });
  if (!removed && currentRoomCode && roomData && !roomData.items.some((item) => item.id === itemId)) {
    showMessage(elements.roomMessage, "That item is no longer in the cart. The latest room data has been displayed.", "warning");
  }
}

function leaveRoom() {
  if (!currentRoomCode || !roomData) {
    showMessage(elements.accessMessage, "You are not currently in a room.", "warning");
    showAccessScreen();
    return;
  }

  const leftRoomCode = currentRoomCode;
  const name = currentUser;
  const didRecordLeave = mutateRoom((updatedRoom) => {
    recordActivity(updatedRoom, name, "left the room");
  });

  let sessionError = null;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    sessionError = error;
  }
  showAccessScreen();
  elements.roomCodeInput.value = "";
  elements.addItemForm.reset();
  elements.itemQuantity.value = "1";
  if (sessionError) {
    const activityMessage = didRecordLeave ? "Your room activity was saved" : "Your room activity could not be saved";
    showMessage(elements.noticeMessage, `${activityMessage}, but this browser could not clear the saved session. ${sessionError.message}`, "warning");
  } else if (!didRecordLeave) {
    showMessage(elements.noticeMessage, `You left room ${leftRoomCode}, but the leave activity could not be saved.`, "warning");
  } else {
    hideMessage(elements.noticeMessage);
  }
}

async function copyRoomCode() {
  if (!currentRoomCode) {
    showMessage(elements.roomMessage, "Join or create a room before copying a room code.", "warning");
    return;
  }
  try {
    await navigator.clipboard.writeText(currentRoomCode);
    showMessage(elements.roomMessage, "Room code copied. Share it with your group.", "success");
  } catch {
    showMessage(elements.roomMessage, "The room code could not be copied automatically. Select and copy it from the room heading.", "warning");
  }
}

function printReceipt() {
  if (!currentRoomCode || !roomData) {
    showMessage(elements.accessMessage, "Join a room before printing a receipt.", "warning");
    showAccessScreen();
    return;
  }
  if (roomData.items.length === 0) {
    showMessage(elements.roomMessage, "Add at least one item before printing a receipt.", "warning");
    return;
  }
  window.print();
}

function handleStorageChange(event) {
  if (!currentRoomCode || (event.key !== null && event.key !== roomStorageKey(currentRoomCode))) {
    return;
  }

  if (event.newValue === null) {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      showMessage(elements.roomMessage, `This room was removed in another tab, but the saved session could not be cleared. ${error.message}`, "warning");
    }
    showAccessScreen();
    showMessage(elements.accessMessage, "This room is no longer available in this browser.", "warning");
    return;
  }

  let updatedRoom;
  try {
    updatedRoom = JSON.parse(event.newValue);
  } catch (error) {
    showMessage(elements.roomMessage, "A room update from another tab could not be read. The current view was kept.", "danger");
    return;
  }
  if (!isValidStoredRoom(updatedRoom, currentRoomCode)) {
    showMessage(elements.roomMessage, "A room update from another tab had invalid data. The current view was kept.", "danger");
    return;
  }

  roomData = updatedRoom;
  hideMessage(elements.roomMessage);
  renderRoom();
}

function restoreCurrentSession() {
  let savedSession;
  try {
    const savedValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!savedValue) {
      return;
    }
    savedSession = JSON.parse(savedValue);
  } catch (error) {
    showMessage(elements.accessMessage, `The saved room session could not be read. ${error.message}`, "warning");
    return;
  }

  if (
    !savedSession ||
    typeof savedSession.name !== "string" ||
    !savedSession.name.trim() ||
    typeof savedSession.roomCode !== "string" ||
    !ROOM_CODE_PATTERN.test(savedSession.roomCode)
  ) {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      showMessage(elements.accessMessage, `The saved room session is invalid and could not be cleared. ${error.message}`, "warning");
      return;
    }
    showMessage(elements.accessMessage, "The saved room session was invalid. Please join or create a room again.", "warning");
    return;
  }

  try {
    const savedRoom = readRoom(savedSession.roomCode);
    if (!savedRoom) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      showMessage(elements.accessMessage, "Your previous room could not be found. Join or create a room to continue.", "warning");
      return;
    }
    currentUser = savedSession.name.trim();
    currentRoomCode = savedSession.roomCode;
    roomData = savedRoom;
    elements.username.value = currentUser;
    showRoomScreen();
    renderRoom();
  } catch (error) {
    showMessage(elements.accessMessage, error.message, "danger");
  }
}

elements.createRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = getUsername();
  if (name) {
    createRoom(name);
  }
});

elements.joinRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = getUsername();
  if (name) {
    joinRoom(name, elements.roomCodeInput.value.trim().toUpperCase());
  }
});

elements.roomCodeInput.addEventListener("input", () => {
  elements.roomCodeInput.value = elements.roomCodeInput.value.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
});

elements.addItemForm.addEventListener("submit", addItem);
elements.leaveRoomButton.addEventListener("click", leaveRoom);
elements.copyCodeButton.addEventListener("click", copyRoomCode);
elements.printReceiptButton.addEventListener("click", printReceipt);
window.addEventListener("storage", handleStorageChange);

restoreCurrentSession();