# Multi-Agent AI Service for Students

A comprehensive AI-powered assistant for university students, featuring a RAG-based chatbot with multi-agent orchestration and a modern web interface.

## 🏗 System Architecture

The system consists of two main components:

1.  **Backend (`/app`)**: Built with **FastAPI**, **LangChain**, and **ChromaDB**. It handles the RAG logic, multi-agent routing (Academic, Regulation, Student Life), and database operations.
2.  **Frontend (`/uni-rag-next`)**: Built with **Next.js 15**. It provides a responsive chat interface and a comprehensive admin dashboard.

## 🚀 Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL** (Optional, defaults to SQLite for dev)
- **Google Gemini API Key**

### 1. Backend Setup

Navigate to the root directory:

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure Environment
# Create a .env file based on .env.example
# Ensure you set your GOOGLE_API_KEY
```

Run the backend server:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

### 2. Frontend Setup

Navigate to the frontend directory:

```bash
cd uni-rag-next

# Install dependencies
npm install

# Configure Environment
# Create .env.local
echo "NEXT_PUBLIC_API_BASE=http://localhost:8000" > .env.local
```

Run the frontend server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## 📖 Usage Guide

### 💬 Chat Interface
- **Ask Questions**: Type your query about university regulations, courses, or student life.
- **Suggestions**: Use the "Next Topic" cards to explore related information.
- **Feedback**: Rate answers to help improve the system.

### 🛠️ Admin Dashboard
Access the dashboard at `http://localhost:3000/admin`.

#### 1. Authentication
- Enter your **Admin Token** (configured in backend `.env`) in the "Settings" tab to unlock admin features.

#### 2. Managing Documents
Go to the **"Upload" (เพิ่มเนื้อหา)** tab to add knowledge:

*   **Text Documents**:
    - Fill in the Title and Content fields.
    - Click "Create New" to save.
    - Use the "Edit" button in the list to modify existing docs.

*   **PDF Documents (New!)**:
    - **Drag & Drop**: Simply drag a PDF file into the drop zone.
    - **Upload**: Click the upload button to process the file. The system will automatically chunk and index the content.

#### 3. Document Preview (New!)
In the **"Documents" (เอกสารทั้งหมด)** tab:
- Click the **"View" (👁️ ดู)** button on any document.
- A **Preview Modal** will appear, showing the full content and metadata immediately.
- You can switch to **Edit Mode** directly from the preview.

#### 4. Statistics
- View real-time stats on top questions, user intent distribution, and feedback scores.

## 🚀 Deployment Guide

### Server Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended) or Windows Server
- **RAM**: Minimum 4GB, 8GB+ recommended
- **Storage**: 10GB+ free space
- **Docker**: Version 20.10+
- **Docker Compose**: Version 1.29+

### Environment Configuration

#### 1. Backend (.env)
```bash
# Copy the example file
cp .env.example .env

# Edit .env and configure:
# - ADMIN_TOKEN: Set a strong secret key
# - GEMINI_API_KEY: Your Google Gemini API key
# - DATABASE_URL: Update for production database if needed
# - ALLOWED_ORIGINS: Set to your frontend domain(s)
#   Example: ALLOWED_ORIGINS=https://chat.yourdomain.com,https://www.yourdomain.com
```

#### 2. Frontend (.env.local)
```bash
cd uni-rag-next

# Copy the example file
cp env.local.example .env.local

# Edit .env.local:
# - NEXT_PUBLIC_API_BASE: Set to your backend API URL
#   Example: NEXT_PUBLIC_API_BASE=https://api.yourdomain.com
```

### Docker Deployment

#### 1. Build and Start Services
```bash
# Build and start all services (database + backend)
docker-compose up -d --build

# Check logs
docker-compose logs -f backend
```

#### 2. Deploy Frontend

For production, build the Next.js app:
```bash
cd uni-rag-next
npm run build
npm start
```

Or use a process manager like PM2:
```bash
npm install -g pm2
pm2 start "npm start" --name "mfu-chat-frontend"
pm2 save
pm2 startup
```

### Nginx Reverse Proxy (Recommended)

Example configuration:

```nginx
# Frontend
server {
    listen 80;
    server_name chat.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Don't forget to add SSL certificates using Let's Encrypt (certbot)!**

### Security Checklist
- [ ] Change default `ADMIN_TOKEN` to a strong random value
- [ ] Set `ALLOWED_ORIGINS` to your actual domain(s)
- [ ] Never expose `.env` files
- [ ] Use HTTPS in production
- [ ] Set up firewall rules (allow only 80, 443, SSH)
- [ ] Regular backups of database and ChromaDB data

### Troubleshooting

**Backend won't start:**
- Check Docker logs: `docker-compose logs backend`
- Verify `.env` file exists and has correct values
- Ensure ports 8000 and 5432 are not in use

**Frontend can't connect to backend:**
- Verify `NEXT_PUBLIC_API_BASE` in `.env.local`
- Check CORS settings (`ALLOWED_ORIGINS` in backend `.env`)
- Test backend API directly: `curl http://your-backend-url/`

**Database connection errors:**
- Check `DATABASE_URL` format
- Ensure Postgres container is running: `docker ps`
- Check Postgres logs: `docker-compose logs db`

