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
    .modal-form input[type="text"] {
      padding: 8px 12px;
      font-size: 14px;
      border-radius: 4px;
      width: 100%;
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
    th.modified, td.modified {
      width: 140px;
    }
    th.size, td.size {
      width: 70px;
      text-align: right;
    }
    th.actions, td.actions {
      width: 40px;
      text-align: center;
      padding-right: 0;
    }
    td.name a {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    a {
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    
    /* Actions menu */
    td.actions {
      overflow: visible;
      position: relative;
    }
    .actions-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 16px;
      line-height: 1;
      border-radius: 4px;
    }
    .actions-btn:hover {
      background: rgba(128, 128, 128, 0.2);
    }
    .actions-menu {
      position: static;
    }
    .actions-popup {
      display: none;
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      min-width: 160px;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 1000;
      padding: 4px 0;
    }
    .actions-menu:focus-within .actions-popup {
      display: block;
    }
    .actions-popup a,
    .actions-popup button {
      display: block;
      width: 100%;
      padding: 8px 12px;
      text-align: left;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 13px;
      text-decoration: none;
    }
    .actions-popup a:hover,
    .actions-popup button:hover {
      text-decoration: none;
    }
    .actions-popup .danger {
      color: #dc3545;
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
      th.modified, td.modified {
        width: 90px;
      }
      th.size, td.size {
        width: 50px;
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
      .actions-popup {
        right: 0;
        left: auto;
      }
      .modal {
        min-width: auto;
        width: 90vw;
        padding: 16px;
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
    .modal-form input[type="text"] {
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
    .actions-btn {
      color: #666;
    }
    .actions-popup {
      background: #fff;
      border: 1px solid #ddd;
    }
    .actions-popup a,
    .actions-popup button {
      color: #000;
    }
    .actions-popup a:hover,
    .actions-popup button:hover {
      background: #f5f5f5;
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
    .modal-form input[type="text"] {
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
    .actions-btn {
      color: #888;
    }
    .actions-popup {
      background: #2a2a2a;
      border: 1px solid #444;
    }
    .actions-popup a,
    .actions-popup button {
      color: #e0e0e0;
    }
    .actions-popup a:hover,
    .actions-popup button:hover {
      background: #333;
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
