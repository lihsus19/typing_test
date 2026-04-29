const API_BASE_URL = '/api';

const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const guestBtn = document.getElementById('guestBtn');
const authMessage = document.getElementById('authMessage');

function showMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.className = isError ? 'auth-message error-text' : 'auth-message success-text';
}

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!email || !password) {
    showMessage('Please enter your email and password.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Login failed.');
      return;
    }

    localStorage.setItem('fastfingerUser', JSON.stringify(data.user));
    showMessage('Login successful.', false);

    window.location.href = 'index.html';
  } catch (error) {
    console.error('Login error:', error);
    showMessage('Could not connect to the server.');
  }
}

async function signup() {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value.trim();

  if (!name || !email || !password) {
    showMessage('Please complete all sign up fields.');
    return;
  }

  if (password.length < 6) {
    showMessage('Password must be at least 6 characters.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Signup failed.');
      return;
    }

    localStorage.setItem('fastfingerUser', JSON.stringify(data.user));
    showMessage('Account created successfully.', false);

    window.location.href = 'index.html';
  } catch (error) {
    console.error('Signup error:', error);
    showMessage('Could not connect to the server.');
  }
}

async function continueAsGuest() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Guest logout error:', error);
  }

  localStorage.removeItem('fastfingerUser');
  window.location.href = 'index.html';
}
loginBtn?.addEventListener('click', login);
signupBtn?.addEventListener('click', signup);
guestBtn?.addEventListener('click', continueAsGuest);