<div align="center">

<img src="logo.svg" alt="Pitlane Logo" width="460" />

<p align="center">
  <strong>High-performance, open-source fleet maintenance, vehicle intake, and workshop repair platform.</strong><br>
  Built with Vite, React 19, TypeScript, Tailwind CSS, Express, and optional multimodal AI OCR.
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#deployment">Deployment</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61dafb.svg?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178c6.svg?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.8" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.1-38bdf8.svg?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License" />
</p>

</div>

---

## ⚡ What is Pitlane?

Commercial fleet maintenance software is often bloated, expensive, and locked behind heavy recurring SaaS subscriptions. Small-to-medium logistics operators, trade contractors, and independent garages need a fast, rugged, and modern solution for tracking vehicle repairs, MOT expirations, driver handoffs, and part costs.

**Pitlane** is an offline-capable, mobile-first web app and backend engine designed for workshop mechanics, yard foremen, and fleet dispatchers.

### Key Capabilities

- 🚐 **Yard Vehicle Intake & Work Orders**: Rapid intake logging with plate lookup, driver assignment, repair description, urgency tagging, and repair status.
- 📸 **AI-Assisted ANPR & Invoice OCR**: Snap a photo of a van or a paper parts invoice to automatically extract the registration plate, make/model, or itemized line items via Gemini Vision API.
- 📑 **Instant PDF Inspection Reports**: One-click generation of professional A4 inspection sheets and printable work order summaries formatted for workshop clipboards.
- 🧰 **Parts Inventory & Cost Tracking**: Log individual parts, suppliers, and purchase costs to calculate accurate job totals and maintain fleet expenditure analytics.
- 📅 **MOT & Service Expiration Alerts**: Visual countdowns and badges highlighting vehicles approaching MOT expiration or inspection cutoffs.
- 📱 **Mobile PWA & Touch Optimized**: Installable directly on iPads, iPhones, and Android workshop tablets with camera integration and responsive touch targets.
- 📧 **Automated SMTP Dispatch**: Send instant PDF-attached repair dispatch notices to mechanics or management upon job submission.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm** / **yarn**

### 1. Clone the Repository

```bash
git clone https://github.com/rpatty-dev/Pitlane.git
cd Pitlane
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment (Optional)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` | *(Optional)* Google Gemini API key for photo ANPR and invoice OCR | `""` |
| `APP_URL` | Application root URL | `http://localhost:3000` |
| `SMTP_HOST` | *(Optional)* SMTP mail server host for email notifications | `""` |
| `SMTP_USER` | SMTP username | `""` |
| `SMTP_PASS` | SMTP password | `""` |
| `NOTIFICATION_EMAIL`| Recipient email address for new repair dispatches | `""` |

*(Note: Pitlane runs smoothly in local mode without any API keys or SMTP servers configured).*

### 4. Start Development Server

```bash
npm run dev
```

Open your browser at **`http://localhost:3000`**.

---

## 🛠️ Project Structure

```text
Pitlane/
├── api/                    # Serverless API endpoints (Vercel / Node)
│   ├── detect-vehicle.ts   # Vehicle visual classification
│   ├── fleet.ts            # Fleet CRUD operations
│   ├── jobs.ts             # Work orders & intake management
│   ├── ocr-invoice.ts      # Multimodal invoice line-item parser
│   ├── ocr-numberplate.ts  # ANPR license plate extractor
│   └── send-email.ts       # Automated SMTP alert dispatcher
├── public/                 # Static assets, PWA icons, manifest
├── src/
│   ├── components/         # React 19 UI Components
│   │   ├── AddJobModal.tsx     # Intake logging modal with camera upload
│   │   ├── AdminPanelModal.tsx # Fleet roster & mechanic admin
│   │   ├── JobCard.tsx         # Responsive job card with status indicators
│   │   ├── JobDetailView.tsx   # Detailed repair breakdown & printable sheet
│   │   ├── LoginScreen.tsx     # Mechanic PIN & staff authentication
│   │   └── StatsOverview.tsx   # Fleet health & expenditure analytics
│   ├── App.tsx             # Main application shell
│   ├── fleet.json          # Default vehicle database
│   ├── types.ts            # TypeScript interface definitions
│   └── utils.ts            # PDF generation (jsPDF) & data formatters
├── server.ts               # Express development & production server
└── vite.config.ts          # Vite bundler configuration
```

---

## 🏗️ Production Build & Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

Pitlane includes preconfigured `vercel.json` rules for one-click deployment:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frpatty-dev%2FPitlane)

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

Built with help from [Nitech](https://nitech.dev).
