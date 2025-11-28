# MFU Student AI Service - Frontend

The frontend application for the **Multi-Agent AI Service for Students**, built with **Next.js 15**. This interface provides a chat experience for students to inquire about university regulations, courses, and student life, along with an admin dashboard for managing the knowledge base.

## ✨ Features

### 💬 Student Chat Interface
- **Intelligent RAG Chatbot**: Queries university knowledge base to answer student questions.
- **Multi-Agent Support**: Routes questions to specialized agents (Academic, Regulation, Student Life).
- **Interactive UI**:
    - Typing animations for natural feel.
    - "Next Topic" suggestions to guide conversation.
    - Language indicator (TH/EN).
    - Feedback system (Like/Dislike).

### 🛠️ Admin Dashboard (`/admin`)
- **Knowledge Base Management**:
    - **Text Documents**: Create, edit, and delete text-based knowledge.
    - **PDF Upload**: Drag & drop PDF upload support with auto-chunking.
- **Document Preview**:
    - **Instant Preview Modal**: View document content and metadata without leaving the list.
    - Edit mode integration.
- **Statistics & Analytics**:
    - View top questions and intent distribution.
    - Monitor system feedback and usage stats.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Backend service running (see backend README)

### Installation

1.  **Clone the repository** (if you haven't already):
    ```bash
    git clone <repository-url>
    cd uni-rag-next
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment**:
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_API_BASE=http://localhost:8000
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) to view the chat interface.
    Open [http://localhost:3000/admin](http://localhost:3000/admin) to access the admin dashboard.

## 📂 Project Structure

```text
src/
├── app/
│   ├── page.tsx            # Main Chat Interface
│   ├── admin/              # Admin Dashboard
│   ├── globals.css         # Global styles & Theme variables
│   └── layout.tsx          # Root layout
├── components/
│   ├── ChatBubble.tsx      # Chat message component
│   ├── Linkify.tsx         # Link detection in messages
│   └── SidebarModeButton.tsx
└── types/
    └── chat.ts             # TypeScript interfaces
```

## 🎨 Styling
- **CSS Modules & Global CSS**: Uses standard CSS with CSS variables for theming.
- **MFU Identity Colors**:
    - Primary Red: `#7A0019`
    - Gold: `#D4AF37`

## 🤝 Contributing
1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes (`git commit -m 'Add some amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing-feature`)
5.  Open a Pull Request
