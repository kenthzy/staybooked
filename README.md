# Staybooked Chatbot - Your AI-Powered Airbnb Strategy Assistant

This repository contains the code for Staybooked Chatbot, a web application designed to help Airbnb hosts and property managers develop effective strategies through an interactive AI-powered chat interface.

## Overview

Staybooked Chatbot guides users through a series of questions to understand their project budget, target audience, preferred platforms, location, and desired features. Based on these inputs, the chatbot leverages the OpenAI API (via OpenRouter) to generate specific recommendations for pricing, marketing, platform optimization, essential features, and local compliance considerations.

The application also includes user authentication (signup and login), a dashboard for logged-in users, and a news feed that aggregates Airbnb-related articles from the Airbnb Newsroom and CBS News. Users can also save the generated strategy as a PDF.

## Features

- **Interactive Chat Interface:** A user-friendly chatbot that asks relevant questions to gather project details.
- **AI-Powered Strategy Generation:** Utilizes the OpenAI API to provide tailored recommendations based on user input.
- **Follow-Up Questions:** Allows users to ask additional questions after the initial strategy is generated.
- **Strategy Saving:** Option to save the generated strategy as a PDF document.
- **User Authentication:** Secure signup and login functionality.
- **User Dashboard:** A dedicated area for logged-in users.
- **Airbnb Business News Feed:** Aggregates news related to Airbnb from various sources.

## Technologies Used

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Templating:** (Implicit through HTML files)
- **Database:** (Simple JSON file `data/users.json` for user storage)
- **AI Integration:** OpenAI API (via OpenRouter)
- **PDF Generation:** jsPDF library
- **Markdown Parsing:** marked library
- **HTTP Client:** axios
- **RSS Parsing:** rss-parser
- **Web Scraping:** cheerio
- **Session Management:** express-session
- **Password Hashing:** bcryptjs
- **Environment Variables:** dotenv
- **Package Management:** npm

## Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone (https://github.com/kenthzy/staybooked)
   cd staybooked
2. **Install Node.js dependencies:**
   ```bash
   npm install
3. **Create a .env file in the root directory with the following information:**
   ```bash
   PORT=3000
   SESSION_SECRET=your-secret-key
   OPENROUTER_API_KEY=your-openrouter-api-key
5. **Run the server:**
   ```bash
   node server.js
