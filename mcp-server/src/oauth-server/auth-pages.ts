/**
 * HTML templates for OAuth authentication pages
 */

export function getLoginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login / Register</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 450px;
      overflow: hidden;
    }
    .tabs {
      display: flex;
      border-bottom: 2px solid #f0f0f0;
    }
    .tab {
      flex: 1;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      background: #f8f9fa;
      border: none;
      font-size: 16px;
      font-weight: 500;
      color: #666;
      transition: all 0.3s;
    }
    .tab.active {
      background: white;
      color: #667eea;
      border-bottom: 3px solid #667eea;
    }
    .tab-content {
      display: none;
      padding: 30px;
    }
    .tab-content.active {
      display: block;
    }
    h2 {
      color: #333;
      margin-bottom: 25px;
      font-size: 24px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 500;
      font-size: 14px;
    }
    input {
      width: 100%;
      padding: 12px 15px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 15px;
      transition: border-color 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    .error {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    button:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="tabs">
      <button class="tab active" onclick="showTab('login')">Login</button>
      <button class="tab" onclick="showTab('register')">Register</button>
    </div>

    <div id="login-tab" class="tab-content active">
      <h2>Login</h2>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <form method="POST" action="/oauth/login">
        <div class="form-group">
          <label for="login-username">Username</label>
          <input type="text" id="login-username" name="username" required autofocus>
        </div>
        <div class="form-group">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" name="password" required>
        </div>
        <button type="submit">Login</button>
      </form>
    </div>

    <div id="register-tab" class="tab-content">
      <h2>Register</h2>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <form method="POST" action="/oauth/register">
        <div class="form-group">
          <label for="register-username">Username</label>
          <input type="text" id="register-username" name="username" required>
        </div>
        <div class="form-group">
          <label for="register-password">Password</label>
          <input type="password" id="register-password" name="password" required>
        </div>
        <div class="form-group">
          <label for="register-password-confirm">Confirm Password</label>
          <input type="password" id="register-password-confirm" name="passwordConfirm" required>
        </div>
        <button type="submit">Register</button>
      </form>
    </div>
  </div>

  <script>
    function showTab(tab) {
      // Hide all tabs and contents
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Show selected tab and content
      event.target.classList.add('active');
      document.getElementById(tab + '-tab').classList.add('active');
    }

    // Validate password confirmation
    document.getElementById('register-password-confirm')?.addEventListener('input', function() {
      const password = document.getElementById('register-password').value;
      const confirm = this.value;
      if (password !== confirm) {
        this.setCustomValidity('Passwords do not match');
      } else {
        this.setCustomValidity('');
      }
    });
  </script>
</body>
</html>`;
}

export function getAuthorizationPage(
  clientName: string,
  scopes: string[],
  redirectUri: string,
  error?: string
): string {
  const scopeDescriptions: Record<string, string> = {
    read: 'Read your data',
    write: 'Modify your data',
    admin: 'Manage permissions',
  };

  const scopeList = scopes.map(scope => {
    const description = scopeDescriptions[scope] || scope;
    return `<li><strong>${escapeHtml(scope)}</strong>: ${escapeHtml(description)}</li>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorization Confirmation</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 500px;
      padding: 40px;
    }
    h1 {
      color: #333;
      margin-bottom: 15px;
      font-size: 28px;
    }
    .client-name {
      color: #667eea;
      font-size: 20px;
      margin-bottom: 30px;
      font-weight: 600;
    }
    .info {
      color: #666;
      margin-bottom: 25px;
      line-height: 1.6;
    }
    .scopes {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .scopes h2 {
      color: #333;
      font-size: 18px;
      margin-bottom: 15px;
    }
    .scopes ul {
      list-style: none;
      padding-left: 0;
    }
    .scopes li {
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
      color: #555;
    }
    .scopes li:last-child {
      border-bottom: none;
    }
    .error {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .actions {
      display: flex;
      gap: 15px;
    }
    button {
      flex: 1;
      padding: 14px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn-approve {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-approve:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    .btn-deny {
      background: #f0f0f0;
      color: #666;
    }
    .btn-deny:hover {
      background: #e0e0e0;
      transform: translateY(-2px);
    }
    button:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authorization Request</h1>
    <div class="client-name">${escapeHtml(clientName)}</div>
    <div class="info">
      This application requests access to your account and needs the following permissions:
    </div>
    <div class="scopes">
      <h2>Request Permissions</h2>
      <ul>
        ${scopeList}
      </ul>
    </div>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <form method="POST" action="/oauth/authorize">
      <div class="actions">
        <button type="submit" name="action" value="approve" class="btn-approve">Approve</button>
        <button type="submit" name="action" value="deny" class="btn-deny">Deny</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

