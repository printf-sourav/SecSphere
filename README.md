<div align="center">

<img src="https://via.placeholder.com/1280x400/090809/F40000?text=SecSphere+Security+Platform" alt="SecSphere Banner" width="100%"/>

# 🛡️ SecSphere

**A practical, AI-assisted security review platform that scans, explains, and automatically fixes vulnerabilities in your code.**

[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge\&logo=react\&logoColor=%2361DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge\&logo=node.js\&logoColor=white)](https://nodejs.org/)
[![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge\&logo=amazon-aws\&logoColor=white)](https://aws.amazon.com/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge\&logo=tailwind-css\&logoColor=white)](https://tailwindcss.com/)

[Explore the Docs](#api-quick-reference) · [Report Bug](https://github.com/your-username/SecSphere/issues) · [Request Feature](https://github.com/your-username/SecSphere/issues)

</div>

---

## 🚀 See It In Action

<div align="center">
  <img src="https://via.placeholder.com/800x400/161616/F4796B?text=Drop+a+GIF+of+your+Aha!+Moment+Here" alt="SecSphere Demo" width="800"/>
  <p><em>SecSphere identifying a vulnerability and applying an AI-generated fix in real-time.</em></p>
</div>

SecSphere supports three rapid analysis inputs:

* 📄 Single File Upload
* 📦 ZIP Project Upload
* 🔗 GitHub Repository URL

---

## ✨ Feature Highlights

| 🔍 Multi-Source Scanning             | 🧠 AI-Powered Analysis                  | 🛠️ Auto-Fix Engine       |
| :----------------------------------- | :-------------------------------------- | :------------------------ |
| Analyze files, ZIPs, or GitHub repos | AI explanations + fixes via AWS Bedrock | Safe heuristic auto-fixes |

| 🔄 Session Workflow      | 📥 Artifact Export           | 🎓 Learning Loop          |
| :----------------------- | :--------------------------- | :------------------------ |
| Persistent scan sessions | Download fixed ZIP + reports | Learns from user feedback |

---

## 🏗️ Visual Architecture

```mermaid
flowchart LR
	U[User] --> FE[Frontend Dashboard\nReact + Vite]
	FE -->|POST /api/scan| BE[Backend API\nExpress]

	BE --> S1[Core Scanners]
	BE --> S2[Semgrep]
	BE --> S3[Trivy]

	S1 --> AGG[Aggregation]
	S2 --> AGG
	S3 --> AGG

	AGG --> AI[AWS Bedrock]
	AGG --> RP[Report Builder]

	FE -->|Apply Fix| FX[Fix Engine]
	FX --> ZIP[Download Fixed ZIP]
```

---

## 🔄 Workflow

```mermaid
sequenceDiagram
	participant User
	participant UI
	participant API
	participant Scanner
	participant AI
	participant Fix

	User->>UI: Upload ZIP / Repo
	UI->>API: Scan request
	API->>Scanner: Analyze
	Scanner-->>API: Findings
	API->>AI: Generate fix
	AI-->>API: Response
	API-->>UI: Results

	User->>UI: Apply fix
	UI->>API: Patch file
	API->>Fix: Update
	Fix-->>API: Done
	API-->>UI: Download ZIP
```

---

## ⚙️ Installation

```bash
npm --prefix backend install
npm --prefix Frontend install
```

---

## ▶️ Run Locally

### Backend

```bash
npm --prefix backend run start
```

### Frontend

```bash
npm --prefix Frontend run dev
```

---

## 🌐 URLs

* Frontend → http://localhost:5173
* Backend → http://localhost:5000
* Swagger → http://localhost:5000/api-docs

---

## 📌 API Quick Reference

| Method | Endpoint                  | Purpose      |
| ------ | ------------------------- | ------------ |
| POST   | /api/scan                 | Scan code    |
| POST   | /api/fix/apply            | Apply fix    |
| POST   | /api/fix/session/download | Download ZIP |
| GET    | /api-docs                 | Swagger UI   |

---

## 🔒 Security Notes

* Auto-fix is conservative
* Manual review still needed
* Always re-scan after fixes

---

## 🚀 Future Scope

* GitHub PR integration
* SARIF export
* Team-based policies

---

