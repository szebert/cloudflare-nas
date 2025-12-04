import type { Theme } from "../types";

export function getThemeStyles(theme: Theme): string {
  const baseStyles = `
    * {
      box-sizing: border-box;
    }
    html {
      height: 100%;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      margin: 0;
      padding: 20px;
      transition: background-color 0.2s, color 0.2s;
      display: flex;
      flex-direction: column;
      max-height: 100%;
    }
    h1 {
      font-size: 18px;
      font-weight: normal;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    hr {
      border: none;
      margin: 10px 0;
      flex-shrink: 0;
    }
    
    /* Header layout */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 10px;
      flex-shrink: 0;
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    
    /* Table wrapper - shrinks and scrolls when content overflows */
    .table-wrapper {
      flex: 0 1 auto;
      overflow-y: auto;
      min-height: 0;
    }
    
    /* Footer stays visible */
    .footer {
      flex-shrink: 0;
    }
    
    
    
    /* Modal overlay using :target */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2000;
      justify-content: center;
      align-items: center;
    }
    .modal-overlay:target {
      display: flex;
    }
    .modal {
      border-radius: 8px;
      padding: 20px;
      min-width: 300px;
      max-width: 90vw;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    .modal h2 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
    }
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .modal-form input[type="text"],
    .modal-form textarea {
      padding: 8px 12px;
      font-size: 14px;
      border-radius: 4px;
      width: 100%;
    }
    .modal-form textarea {
      resize: vertical;
      font-family: monospace;
      min-height: 100px;
    }
    .modal-wide {
      min-width: 450px;
    }
    .file-input-wrapper {
      padding: 16px;
      border: 2px dashed currentColor;
      border-radius: 8px;
      text-align: center;
      opacity: 0.7;
    }
    .file-input-wrapper:focus-within {
      opacity: 1;
    }
    .file-input-wrapper input[type="file"] {
      width: 100%;
      cursor: pointer;
    }
    .file-hint {
      margin: 8px 0 0 0;
      font-size: 12px;
      opacity: 0.7;
    }
    .modal-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }
    .modal-buttons a,
    .modal-buttons button {
      padding: 8px 16px;
      font-size: 13px;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      border: none;
    }
    .modal-buttons a:hover,
    .modal-buttons button:hover {
      text-decoration: none;
    }
    .btn-cancel {
      background: transparent;
    }
    .btn-primary {
      font-weight: 500;
    }
    
    /* Table */
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    thead {
      position: sticky;
      top: 0;
      z-index: 10;
    }
    th, td {
      text-align: left;
      padding: 6px 8px 6px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    th a {
      text-decoration: none;
    }
    th a:hover {
      text-decoration: underline;
    }
    th.name, td.name {
      width: auto;
    }
    th.type, td.type {
      width: 140px;
    }
    th.modified, td.modified {
      width: 180px;
    }
    /* Show ISO string on desktop, hide date-only */
    .date-iso {
      display: inline;
    }
    .date-only {
      display: none;
    }
    th.size, td.size {
      width: 90px;
      text-align: right;
    }
    th.actions, td.actions {
      width: 40px;
      text-align: center;
      padding-right: 0;
    }
    td.name a {
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    a {
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    
    /* Actions link */
    .actions-link {
      display: inline-block;
      text-decoration: none;
      font-size: 16px;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .actions-link:hover {
      background: rgba(128, 128, 128, 0.2);
      text-decoration: none;
    }
    
    /* Popup switchers (bucket & theme) */
    .switcher-popup {
      position: relative;
      display: inline-block;
    }
    .switcher-btn {
      padding: 4px 10px;
      font-size: 13px;
      border-radius: 4px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .popup-menu {
      display: none;
      position: absolute;
      right: 0;
      top: 100%;
      margin-top: 4px;
      min-width: 140px;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
      padding: 4px 0;
    }
    .switcher-popup:focus-within .popup-menu {
      display: block;
    }
    .popup-item {
      display: block;
      padding: 8px 12px;
      text-decoration: none;
      white-space: nowrap;
    }
    .popup-item:hover {
      text-decoration: none;
    }
    .popup-item.current {
      font-weight: bold;
    }
    .popup-item.disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }
    
    /* Footer */
    .footer {
      margin-top: 20px;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .footer-stats {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }
    .stat {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .stat-label {
      opacity: 0.7;
    }
    
    /* Actions page */
    .actions-page {
      max-width: 450px;
      margin: 30px auto;
    }
    .actions-header {
      margin-bottom: 24px;
    }
    .actions-header h1 {
      margin: 0 0 8px 0;
      font-size: 20px;
    }
    .actions-header .path-info {
      font-size: 13px;
      opacity: 0.7;
      word-break: break-all;
    }
    .action-section {
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .action-section h2 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .action-section p {
      margin: 0 0 12px 0;
      font-size: 13px;
      opacity: 0.8;
    }
    .action-section input[type="text"] {
      width: 100%;
      padding: 8px 12px;
      font-size: 14px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    .action-section .btn {
      padding: 8px 16px;
      font-size: 13px;
      border-radius: 4px;
      cursor: pointer;
      border: none;
      font-weight: 500;
    }
    .action-section.danger {
      border: 1px solid #dc3545;
    }
    .action-section.danger h2 {
      color: #dc3545;
    }
    .btn-danger {
      background: #dc3545;
      color: #fff;
    }
    .btn-danger:hover {
      background: #c82333;
    }
    .back-link {
      display: inline-block;
      margin-top: 16px;
      font-size: 13px;
    }
    
    /* Mobile */
    @media (max-width: 600px) {
      body {
        padding: 12px;
      }
      .header {
        flex-direction: column-reverse;
        align-items: stretch;
        gap: 8px;
      }
      .header-controls {
        justify-content: flex-end;
      }
      h1 {
        font-size: 16px;
      }
      th, td {
        padding: 8px 6px 8px 0;
        font-size: 13px;
      }
      /* Hide Type column on mobile */
      th.type, td.type {
        display: none;
      }
      th.modified, td.modified {
        width: 85px;
      }
      /* Hide ISO string on mobile, show date-only */
      .date-iso {
        display: none;
      }
      .date-only {
        display: inline;
      }
      th.size, td.size {
        width: 70px;
      }
      th.actions, td.actions {
        width: 32px;
      }
      .switcher-btn {
        padding: 4px 8px;
        font-size: 12px;
      }
      .popup-menu {
        min-width: 120px;
      }
      .modal {
        min-width: auto;
        width: 90vw;
        padding: 16px;
      }
      .modal-wide {
        min-width: auto;
      }
    }
  `;

  const lightColors = `
    body {
      background: #fff;
      color: #000;
    }
    hr {
      border-top: 1px solid #ccc;
    }
    th {
      border-bottom: 1px solid #ccc;
      background: #fff;
    }
    th a {
      color: #000;
    }
    a {
      color: #0000cc;
    }
    .footer {
      color: #666;
    }
    .switcher-btn {
      background: #f0f0f0;
      color: #000;
    }
    .switcher-btn:hover {
      background: #e0e0e0;
    }
    .popup-menu {
      background: #fff;
      border: 1px solid #ddd;
    }
    .popup-item {
      color: #000;
    }
    .popup-item:hover {
      background: #f5f5f5;
    }
    .popup-item.current {
      background: #e8f4fc;
    }
    .modal {
      background: #fff;
      border: 1px solid #ddd;
    }
    .modal-form input[type="text"],
    .modal-form textarea {
      border: 1px solid #ccc;
      background: #fff;
      color: #000;
    }
    .btn-cancel {
      color: #666;
    }
    .btn-cancel:hover {
      background: #f0f0f0;
    }
    .btn-primary {
      background: #0066cc;
      color: #fff;
    }
    .btn-primary:hover {
      background: #0055aa;
    }
    .action-section input[type="text"] {
      border: 1px solid #ccc;
      background: #fff;
      color: #000;
    }
  `;

  const darkColors = `
    body {
      background: #1a1a1a;
      color: #e0e0e0;
    }
    hr {
      border-top: 1px solid #444;
    }
    th {
      border-bottom: 1px solid #444;
      background: #1a1a1a;
    }
    th a {
      color: #e0e0e0;
    }
    a {
      color: #6db3f2;
    }
    .footer {
      color: #888;
    }
    .table-wrapper::-webkit-scrollbar-track {
      background: #2a2a2a;
    }
    .table-wrapper::-webkit-scrollbar-thumb {
      background: #555;
    }
    .table-wrapper::-webkit-scrollbar-thumb:hover {
      background: #666;
    }
    .table-wrapper {
      scrollbar-color: #555 #2a2a2a;
    }
    .switcher-btn {
      background: #333;
      color: #e0e0e0;
    }
    .switcher-btn:hover {
      background: #444;
    }
    .popup-menu {
      background: #2a2a2a;
      border: 1px solid #444;
    }
    .popup-item {
      color: #e0e0e0;
    }
    .popup-item:hover {
      background: #333;
    }
    .popup-item.current {
      background: #3a3a3a;
    }
    .modal {
      background: #2a2a2a;
      border: 1px solid #444;
    }
    .modal-form input[type="text"],
    .modal-form textarea {
      border: 1px solid #555;
      background: #1a1a1a;
      color: #e0e0e0;
    }
    .btn-cancel {
      color: #aaa;
    }
    .btn-cancel:hover {
      background: #333;
    }
    .btn-primary {
      background: #0066cc;
      color: #fff;
    }
    .btn-primary:hover {
      background: #0077dd;
    }
    .action-section input[type="text"] {
      border: 1px solid #555;
      background: #1a1a1a;
      color: #e0e0e0;
    }
  `;

  if (theme === "light") {
    return `<style>${baseStyles}${lightColors}</style>`;
  }

  if (theme === "dark") {
    return `<style>${baseStyles}${darkColors}</style>`;
  }

  return `<style>
    ${baseStyles}
    ${lightColors}
    @media (prefers-color-scheme: dark) {
      ${darkColors}
    }
  </style>`;
}
