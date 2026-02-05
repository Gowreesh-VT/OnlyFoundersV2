# OnlyFounders PWA

A premium hackathon management Progressive Web App built with Next.js 16. Features a luxurious dark theme with gold accents, role-based access control, comprehensive management tools, and offline capabilities.

![OnlyFounders](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=flat-square&logo=tailwind-css)
![PWA](https://img.shields.io/badge/PWA-Ready-purple?style=flat-square&logo=pwa)

## ✨ Features

### 🎓 Student Portal
- **Dashboard** - Premium membership card, live countdown, alerts, schedule, and tasks
- **Team Management** - Create new startups or join existing squads with secure 6-digit access codes
- **Submissions** - Submit pitch decks via Google Drive links with validation
- **Real-time Alerts** - In-app notification center with read/unread tracking
- **Haptic Feedback** - Immersive responses on buttons and interactions

### 👔 Admin Portal
- **Dashboard** - College overview with smoke background effects
- **Submissions** - Review team pitch decks, approve/reject/waitlist with one tap
- **Notifications** - Send custom announcements and status updates to teams (In-App + Push)
- **Settings** - Configure hackathon deadlines with toggle controls

### 🏛️ Super Admin Portal
- **Dashboard** - Platform-wide statistics and quick actions
- **College Management** - Onboard new colleges and manage participation
- **Admin Management** - Assign and manage college ambassadors/admins
- **Global Overview** - Monitor all hackathon activities from a single view

### 📲 PWA Capabilities
- **Installable** - Works as a native app on iOS and Android
- **Offline Ready** - Essential features available without internet
- **Push Notifications** - Background notifications via Web Push API (WhatsApp-style)
- **Haptic & Sound** - Native-like feedback system

## 🎨 Design System

### Colors
- **Primary**: `#FFD700` (Gold)
- **Background**: `#0A0A0A` (Jet Black)
- **Surface**: `#121212` (Dark Surface)
- **Border**: `#262626` (Subtle Border)

### Typography
- **Display**: Playfair Display (Serif)
- **Body**: Inter (Sans-serif)

### Effects
- Smoke background textures & glassmorphism
- Gold gradient accents & borders
- Smooth page transitions
- Custom styled toasts and alerts

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase project
- VAPID keys for Push Notifications

### Installation

```bash
# Clone the repository
git clone https://github.com/mithilgirish/onlyfounders-pwa.git
cd onlyfounders-pwa

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
app/
├── api/                # API Routes (Auth, Notifications, Push)
├── auth/
│   ├── login/          # Login page
│   ├── register/       # Registration page
│   ├── forgot-password/# Password recovery
│   └── reset-password/ # Set new password
├── dashboard/          # Student dashboard
├── team/               # Create/Join team logic
├── submission/         # Pitch submission
├── admin/              # Admin routes
└── super-admin/        # Super Admin routes
components/             # Reusable UI components
public/
├── custom-sw.js        # Custom Service Worker (Push)
└── manifest.json       # PWA Manifest
supabase/               # SQL migrations & templates
```

## 🔐 Auth & Security
- **Authentication**: Supabase Auth (Email/Password)
- **Authorization**: Role-based access (Student, Admin, Super Admin) via Middleware
- **Password Recovery**: Secure email-based reset flow
- **Push Security**: VAPID key signing for web push notifications

## � Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + Realtime)
- **PWA**: next-pwa + Workbox
- **Icons**: Lucide React
- **Fonts**: Google Fonts (Playfair Display, Inter)

---
© 2026 ONLYFOUNDERS - The Exclusive Network
