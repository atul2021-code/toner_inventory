# 🖨️ TonerTrack Pro - Toner & Printer Fleet Inventory

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Deployment-brightgreen)](https://atul2021-code.github.io/toner_inventory/)
[![Security: Clean & Verified](https://img.shields.io/badge/Security-Zero%20Credentials-brightgreen.svg)](#-security--privacy-guarantee)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A standalone toner cartridge and printer fleet management system running 100% client-side via GitHub Pages with persistent browser storage, automatic purchase requisition calculations, and audit history tracking.

---

## 🌐 Live Application
Access the production application directly via GitHub Pages:
👉 **[https://atul2021-code.github.io/toner_inventory/](https://atul2021-code.github.io/toner_inventory/)**

---

## 🔒 Security & Privacy Guarantee

- **Zero Hardcoded Secrets:** There are no API keys, tokens, secret passwords, or cloud credentials stored in this repository.
- **Client-Side Isolated:** Runs purely inside the browser using `localStorage`.
- **Encrypted Data Backups:** Supports client-side AES-256 (AES-GCM + PBKDF2) encryption for inventory exports.
- **Safe from Scraping:** No external backend services or databases are exposed to attackers.

---

## ⚡ Key Capabilities

- **Consumables Inventory:** Real-time stock counts with color badges for CMYK (Cyan, Magenta, Yellow, Black) and Drum units.
- **Stock Steppers:** 1-click +1 and -1 stock adjustments right inside table rows.
- **Threshold Alerts:** Automatic alerts when any cartridge level reaches or drops below its minimum threshold.
- **Fleet Mapping:** Associate toner models with departmental printers and network IP addresses.
- **Purchase Order Requisition:** 1-click generation and clipboard copying of purchase requisition orders based on threshold triggers.
- **Audit Logging:** Full transaction history tracking who took or restocked which cartridge, when, and for which printer.
- **Data Portability:** JSON backup & restore tools plus instant CSV export of all inventory items and audit records.

---

## 🚀 Quick Deployment to GitHub Pages

1. Upload all files from this repository to your `main` branch.
2. Go to **Settings** > **Pages** in your GitHub repository.
3. Under **Branch**, select `main` and folder `/ (root)`.
4. Click **Save**. Within 60 seconds your site will be live!

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
