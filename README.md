# Smart News Analysis Platform

A full-stack application that combines news aggregation with AI-powered sentiment and political bias analysis. The platform consists of two main components: **Agora** (frontend) and **Logos** (backend).

## Project Overview

### Agora (Frontend)
*From the Greek word meaning "gathering place"*

Agora serves as the central hub where news from around the globe converges, much like the ancient Greek agora was a gathering place for political, social, and cultural discourse. This React-based frontend provides:

- **News Discovery**: Search and browse articles from multiple sources
- **Intelligent Analysis**: View AI-generated summaries, sentiment analysis, and political bias detection
- **Interactive Dashboard**: Explore analytics and trends across different news sources
- **Real-time Updates**: Live headlines banner with periodic updates

### Logos (Backend)
*From the Greek word meaning "word" and "reasoning"*

Logos embodies the logical foundation and reasoning engine of the platform. This Node.js/Express backend handles:

- **News Aggregation**: Fetches articles from multiple news APIs (GNews, NewsAPI, Guardian)
- **AI Analysis**: Processes articles through OpenAI's GPT models for sentiment and bias analysis
- **Data Management**: Stores and retrieves analyzed articles using MongoDB
- **API Services**: Provides RESTful endpoints for frontend consumption

## Technology Stack

### Frontend (Agora)
- **React** - User interface framework
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **React Hot Toast** - Notifications
- **Axios** - HTTP client

### Backend (Logos)
- **Node.js & Express** - Server framework
- **MongoDB & Mongoose** - Database and ODM
- **OpenAI API** - AI analysis service
- **GNews API** - News aggregation
- **Helmet & CORS** - Security middleware

## Setup Guide

### Prerequisites

1. **Node.js** (v16 or higher)
   ```bash
   # Check version
   node --version
   npm --version
   ```

2. **MongoDB** (Local installation)
   
   **On macOS:**
   ```bash
   # Using Homebrew
   brew tap mongodb/brew
   brew install mongodb-community
   
   # Start MongoDB service
   brew services start mongodb/brew/mongodb-community
   ```
   
   **On Ubuntu/Debian:**
   ```bash
   # Import MongoDB public key
   curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
   
   # Add MongoDB repository
   echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
   
   # Install MongoDB
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   
   # Start MongoDB service
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```
   
   **On Windows:**
   - Download MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community)
   - Follow the installation wizard
   - MongoDB will run as a Windows service

### Installation Steps

1. **Clone and navigate to the project**
   ```bash
   cd project
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies (Logos)**
   ```bash
   cd logos
   npm install
   cd ..
   ```

4. **Install frontend dependencies (Agora)**
   ```bash
   cd agora
   npm install
   cd ..
   ```

### Environment Configuration

#### Backend Environment (logos/.env)
Create a `.env` file in the `logos` directory with the following variables:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/smart-news-analysis

# OpenAI Configuration (Required)
LLM_API_KEY=your_openai_api_key_here
LLM_MODEL=gpt-4o-mini

# News API Keys (At least one required)
GNEWS_API_KEY=your_gnews_api_key_here

[OPTIONAL]
NEWSAPI_KEY=your_newsapi_key_here

# Server Configuration
PORT=5001
NODE_ENV=development
```

#### Frontend Environment (agora/.env)
Create a `.env` file in the `agora` directory:

```env
# Backend API URL
REACT_APP_API_URL=http://localhost:5001/api/v1
```

### API Keys Setup

1. **OpenAI API Key** (Required)
   - Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create an account and generate an API key
   - Add credits to your account for usage

2. **GNews API Key** (Recommended)
   - Visit [GNews.io](https://gnews.io/)
   - Sign up for a free account
   - Get your API key from the dashboard

3. **NewsAPI Key** (Optional)
   - Visit [NewsAPI.org](https://newsapi.org/)
   - Register for a free developer account
   - Copy your API key

### Running the Application

#### Development Mode

1. **Start both services simultaneously:**
   ```bash
   npm run dev
   ```

2. **Or start services individually:**
   
   **Backend only:**
   ```bash
   npm run server
   ```
   
   **Frontend only:**
   ```bash
   npm run client
   ```

#### Production Mode

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Start the backend:**
   ```bash
   npm start
   ```

### Access the Application

- **Frontend (Agora)**: http://localhost:3000
- **Backend API (Logos)**: http://localhost:5001
- **API Documentation**: http://localhost:5001/api/v1

### Verify Installation

1. **Check MongoDB connection:**
   ```bash
   # Connect to MongoDB shell
   mongosh
   
   # List databases
   show dbs
   
   # Exit
   exit
   ```

2. **Test the backend:**
   ```bash
   curl http://localhost:5001/api/v1/news/providers
   ```

3. **Access the frontend and try searching for news articles**

## Features

### Core Functionality
- **Multi-source News Aggregation**: Fetch articles from various news APIs
- **AI-Powered Analysis**: Automatic sentiment analysis and political bias detection
- **Smart Caching**: Avoid re-analyzing the same articles
- **Advanced Search**: Filter by sentiment, political bias, date ranges
- **Analytics Dashboard**: View trends and statistics
- **Responsive Design**: Works on desktop and mobile devices

### API Endpoints
- `GET /api/v1/news/search` - Search news articles
- `GET /api/v1/news/headlines` - Get top headlines
- `POST /api/v1/analysis/article` - Analyze article with AI
- `GET /api/v1/analysis/stats` - Get analysis statistics
- `GET /api/v1/analysis/search` - Search analyzed articles
