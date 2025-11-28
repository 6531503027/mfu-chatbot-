# Multi-Agent AI Service for Students

A comprehensive AI-powered assistant for university students, featuring a RAG-based chatbot with multi-agent orchestration and a modern web interface.

## 🌐 Live Deployment

**The application is currently deployed and accessible at:**

- **Student Chat**: [https://mfu-chatbot.vercel.app/](https://mfu-chatbot.vercel.app/)
- **Admin Dashboard**: [https://mfu-chatbot.vercel.app/admin](https://mfu-chatbot.vercel.app/admin)

**Architecture:**
- **Frontend**: Deployed on Vercel (auto-deploys from `main` branch)
- **Backend**: Running on AWS EC2 (Ubuntu, Docker)
- **Connectivity**: Secured via ngrok HTTPS tunnel

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

### 💬 Student Chat Interface

**Access:** [https://mfu-chatbot.vercel.app/](https://mfu-chatbot.vercel.app/)

The chatbot provides intelligent answers about university information across three domains:

1. **Academic Information** 📚
   - Course details and curricula
   - Registration procedures
   - Academic calendar
   - Grade inquiries

2. **University Regulations** 📋
   - Student conduct rules
   - Academic policies
   - Examination regulations
   - Graduation requirements

3. **Student Life** 🎓
   - Campus facilities
   - Dormitory information
   - Student activities
   - Campus services

**How to Use:**

1. **Ask Questions:**
   - Type your question in Thai or English
   - Press Enter or click the send button
   - The bot will analyze and route to the appropriate specialist agent

2. **Explore Related Topics:**
   - After receiving an answer, look for "คำถามที่เกี่ยวข้อง" (Related Topics) cards
   - Click any card to automatically ask that follow-up question

3. **Provide Feedback:**
   - Rate answers using the 👍 (Helpful) or 👎 (Not Helpful) buttons
   - Optionally add comments to help improve the system

**Example Questions:**
- "ลงทะเบียนเรียนเมื่อไหร่?"
- "วิธีการรับทุนการศึกษา"
- "หอพักมีห้องว่างไหม"
- "เกรดเฉลี่ยต่ำกว่า 2.00 ทำอย่างไร"

---

### 🛠️ Admin Dashboard

**Access:** [https://mfu-chatbot.vercel.app/admin](https://mfu-chatbot.vercel.app/admin)

The admin dashboard provides complete control over the knowledge base and system monitoring.

#### 1️⃣ First Time Setup

1. **Navigate to Settings Tab (⚙️ ตั้งค่า)**
2. **Enter Admin Token:**
   - Use the token configured in your backend `.env` file
   - Default: `very-secret-admin-key` (change this in production!)
3. **Click "Save Token"**
4. Dashboard features will unlock

#### 2️⃣ Managing Documents (📄 เอกสารทั้งหมด)

**View All Documents:**
- See complete list of knowledge base documents
- Filter by type: Text documents vs PDF documents
- Search by title using the search bar

**Document Actions:**
- **👁️ View (ดู)**: Preview document content in a modal
- **✏️ Edit (แก้ไข)**: Modify existing document
- **🗑️ Delete (ลบ)**: Remove document from knowledge base

#### 3️⃣ Adding New Content (➕ เพิ่มเนื้อหา)

**Method 1: Text Content**

1. **Go to "เพิ่มเนื้อหา" tab**
2. **Fill in the form:**
   - **Title (ชื่อเรื่อง)**: Document title
   - **Content (เนื้อหา)**: Full text content (supports long text)
   - **Updated By (ผู้แก้ไข)**: Your name/identifier
3. **Click "✨ Create New Document"**
4. Document is automatically indexed for search

**Method 2: PDF Upload**

1. **Go to "เพิ่มเนื้อหา" tab → "📄 Upload PDF" section**
2. **Upload PDF:**
   - **Drag & Drop**: Simply drag PDF file into the drop zone
   - **Or Click**: Click "Choose File" to browse
3. **Click "📤 Upload PDF"**
4. System automatically:
   - Extracts text from PDF
   - Creates document entry
   - Indexes content for RAG search

**Supported:**
- PDF files up to reasonable size
- Multi-page PDFs
- Thai and English text

#### 4️⃣ Viewing Feedback (� Feedback)

**Monitor User Satisfaction:**
- See all user feedback submissions
- View which answers were helpful/not helpful
- Read user comments for improvement suggestions

**Feedback Details:**
- Original question
- Bot's answer
- User rating (👍/👎)
- Optional comment
- Timestamp

#### 5️⃣ Statistics Dashboard (📊 สถิติ)

**Key Metrics:**
- **Total Questions**: Number of queries handled
- **Total Documents**: Knowledge base size
- **Feedback Rate**: User satisfaction percentage

**Top Questions:**
- Most frequently asked questions
- Helps identify popular topics
- Use to add more detailed content

**Intent Distribution:**
- Breakdown by category (Academic/Regulation/Student Life)
- Understand user needs
- Optimize agent performance

## 🚀 Deployment Guide

### Production Deployment (Current Setup)

The application is deployed using a hybrid approach:
- **Frontend**: Vercel (auto-deploys from GitHub)
- **Backend**: AWS EC2 with Docker
- **SSL/HTTPS**: ngrok tunnel for secure connections

#### 1. EC2 Backend Setup

**Server Specifications:**
- **Instance Type**: t3.small or larger
- **OS**: Ubuntu 20.04+
- **Storage**: 20GB+ recommended
- **Network**: Elastic IP configured

**Installation Steps:**

```bash
# SSH into your EC2 instance
ssh ubuntu@your-ec2-ip

# Install Docker and Docker Compose
sudo apt update
sudo apt install -y docker.io docker-compose git

# Clone repository
git clone https://github.com/6531503027/mfu-chatbot-.git
cd mfu-chatbot

# Configure environment
cp .env.example .env
nano .env  # Edit with your settings

# Start services
docker-compose up -d --build

# Verify services are running
docker ps
```

#### 2. ngrok Setup (HTTPS Tunnel)

ngrok provides the HTTPS endpoint for the backend:

```bash
# Install ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok

# Add your authtoken (get from https://dashboard.ngrok.com)
ngrok config add-authtoken YOUR_NGROK_TOKEN

# Run ngrok in background (persistent)
sudo apt install tmux -y
tmux new -s ngrok
ngrok http 8000

# Detach from tmux: Press Ctrl+B, then D
# Or use nohup:
nohup ngrok http 8000 > ngrok.log 2>&1 &

# Get the ngrok URL
curl http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*'
```

**⚠️ Important:** Copy the ngrok HTTPS URL - you'll need it for Vercel configuration.

#### 3. Vercel Frontend Deployment

**Initial Setup:**

1. **Fork/Push to GitHub:**
   ```bash
   # Ensure code is pushed to GitHub
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure:
     - **Root Directory**: `uni-rag-next`
     - **Framework Preset**: Next.js
     - **Environment Variables**:
       - `NEXT_PUBLIC_API_BASE` = `https://your-ngrok-url.ngrok-free.dev`

3. **Deploy and verify** at your Vercel URL

**Updating ngrok URL (when it changes):**

```bash
# On Vercel Dashboard:
# 1. Go to Project Settings → Environment Variables
# 2. Update NEXT_PUBLIC_API_BASE
# 3. Redeploy the project
```

#### 4. Backend CORS Configuration

Ensure your backend `.env` allows the Vercel domain:

```bash
# In /mfu-chatbot/.env on EC2
ALLOWED_ORIGINS=https://your-app.vercel.app,https://*.vercel.app

# Or use regex to allow all (as currently configured):
# The app uses allow_origin_regex=".*" in main.py
```

#### 5. Admin Access

**Admin Token Setup:**
```bash
# Set a secure token in backend .env
ADMIN_TOKEN=your-secure-admin-key-here
```

**To access admin dashboard:**
1. Navigate to: `https://your-app.vercel.app/admin`
2. Go to "Settings" tab
3. Enter your admin token
4. Click "Save Token"

### Local Development

#### Backend Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r app/requirements.txt

# Configure Environment
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY

# Run backend
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup

```bash
cd uni-rag-next

# Install dependencies
npm install

# Configure Environment
cp env.local.example .env.local
echo "NEXT_PUBLIC_API_BASE=http://localhost:8000" > .env.local

# Run frontend
npm run dev
```

The application will be available at `http://localhost:3000`.

### Troubleshooting

**"Failed to fetch" or "Unexpected token <" errors:**

1. **Check ngrok is running:**
   ```bash
   ssh ubuntu@your-ec2-ip
   ps aux | grep ngrok
   # If not running, restart it
   ```

2. **Verify ngrok URL in Vercel:**
   - Vercel Dashboard → Settings → Environment Variables
   - Ensure `NEXT_PUBLIC_API_BASE` matches current ngrok URL

3. **Clear browser cache:**
   - Press `Ctrl+Shift+R` (hard refresh)

4. **Force Vercel rebuild:**
   - Push a new commit to trigger fresh deployment

**Backend won't start:**
```bash
# Check Docker logs
docker-compose logs -f backend

# Restart services
docker-compose restart backend

# Rebuild if needed
docker-compose up -d --build backend
```

**ngrok URL changes:**
- Free ngrok URLs change on restart
- Either use paid ngrok (static URLs) or update Vercel env vars after each restart

### Monitoring

**Check backend status:**
```bash
# SSH into EC2
docker ps                           # View running containers
docker-compose logs --tail=50 backend   # View recent logs
curl http://localhost:8000/health  # Test backend endpoint
```

**Check ngrok status:**
```bash
curl http://localhost:4040/api/tunnels  # View tunnel info
tail -f ngrok.log                      # If using nohup
```

### Security Checklist
- [x] Backend running on EC2 with Elastic IP
- [x] HTTPS via ngrok tunnel
- [x] Strong admin token configured
- [x] CORS properly configured
- [x] `.env` files not committed to Git
- [ ] Consider upgrading to paid ngrok for static URL (optional)
- [ ] Regular database backups configured
- [ ] Monitoring and alerting set up

