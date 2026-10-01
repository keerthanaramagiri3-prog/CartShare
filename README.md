# CartShare – Collaborative Shopping Cart

## About the Project

CartShare is a collaborative shopping cart web application designed for groups of people who want to manage their shopping together.

It can be useful for students, office teams, travel groups, or people living together.

The application allows users to create or join a room, add and remove shopping items, view the activities of participants, and generate a printable receipt.

## Problem

When people shop together, it can be difficult to keep track of everyone's items.

People may use different tools such as messages, notes, or spreadsheets. This can lead to:

- Missing items
- Duplicate purchases
- Confusion about who added an item
- Difficulty calculating the total amount
- Problems while coordinating a shared order

CartShare provides one place to manage the shared shopping cart.

## Main Features

### 1. User Access

Users can enter their name before using the application.

The application uses HTML forms and JavaScript to handle the user information.

### 2. Create or Join a Room

Users can create a new room or join an existing room using a unique room code.

Each room has its own shopping cart and activity information.

### 3. Shared Shopping Cart

Users can add shopping items to the shared cart.

Each item contains information such as:

- Item name
- Quantity
- Price
- Person who added the item

Users can also remove items from the cart.

The total cart amount is calculated automatically.

### 4. Activity Log

The application keeps an activity log for the room.

It can show activities such as:

- A user joining a room
- A user adding an item
- A user removing an item

This makes it easier to see what participants are doing.

### 5. Browser Storage

CartShare uses browser storage to keep the cart data available after refreshing the page.

The data is organized according to the room so that different rooms can have separate cart information.

### 6. Browser Tab Synchronization

CartShare uses JavaScript event listeners to synchronize changes between browser tabs.

For example, when an item is added or removed in one browser tab, the other tab using the same room can update the cart.

This provides a simple way to simulate multiple users working together.

### 7. Responsive Design

The application is designed to work on different screen sizes, including:

- Mobile phones
- Tablets
- Laptops
- Desktop computers

CSS Flexbox, CSS Grid, and Bootstrap are used to create the responsive layout.

### 8. Printable Receipt

CartShare provides a printable receipt for the current room.

The receipt includes:

- Room code
- Shopping items
- Quantity
- Price
- Person who added the item
- Total amount

JavaScript is used to prepare the receipt and CSS print rules are used to create a clean print layout.

## Technologies Used

- HTML5
- CSS3
- JavaScript
- Bootstrap
- Browser localStorage
- Browser storage events

## Project Structure

```text
CartShare/
│
├── index.html
│
├── README.md
│
├── css/
│   └── style.css
│
├── js/
│   └── script.js
│
└── assets/
    └── images and other required assets