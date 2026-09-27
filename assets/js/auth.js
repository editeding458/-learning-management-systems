document.addEventListener('DOMContentLoaded', () => {
    
   
    if (!localStorage.getItem('usersDB')) {
        const defaultUsers = [
            { id: 1, name: "Admin", email: "admin@gmail.com", password: "123", role: "admin" },
            { id: 2, name: "Student", email: "student@gmail.com", password: "123", role: "student" }
        ];
        localStorage.setItem('usersDB', JSON.stringify(defaultUsers));
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const role = document.getElementById('role').value;

            let users = JSON.parse(localStorage.getItem('usersDB')) || [];

         
            const userExists = users.some(u => u.email === email);
            if (userExists) {
                alert('This email is already registered!');
                return;
            }

            const newUser = { id: Date.now(), name, email, password, role };
            users.push(newUser);

            // Save JSON back to storage
            localStorage.setItem('usersDB', JSON.stringify(users));
            alert('Registration Successful! Please Sign In.');
            window.location.href = 'signin.html';
        });
    }

    // 2. Handle Sign In
    const signinForm = document.getElementById('signinForm');
    if (signinForm) {
        signinForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const role = document.getElementById('role').value;

            let users = JSON.parse(localStorage.getItem('usersDB')) || [];

         
            const matchedUser = users.find(u => u.email === email && u.password === password && u.role === role);

            if (!matchedUser) {
                alert('Invalid Email, Password or Selected Role! Register first if you don\'t have an account.');
                return;
            }

        
            localStorage.setItem('loggedInUser', JSON.stringify(matchedUser));

       
            if (matchedUser.role === 'admin') {
                window.location.href = '../admin-dashboard/admin.html';
            } else {
                window.location.href = '../student-dashboard/index.html';
            }
        });
    }


    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('loggedInUser');
            window.location.href = 'signin.html';
        });
    }
});

function protectRoute(requiredRole) {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    if (!loggedInUser) {
        alert('Access Denied! Please Sign In first.');
        window.location.href = 'signin.html';
        return;
    }

    if (loggedInUser.role !== requiredRole) {
        alert('Unauthorized Access!');
        if (loggedInUser.role === 'admin') {
            window.location.href = '../admin-dashboard/admin.html';
        } else {
            window.location.href = '../student-dashboard/index.html';
        }
    }
}
