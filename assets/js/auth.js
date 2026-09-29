document.addEventListener('DOMContentLoaded', () => {
    
   
    const defaultUsers = [
            { id: 1, name: "Admin", email: "admin@gmail.com", password: "123", role: "admin" },
            { id: 2, name: "Student", email: "student@gmail.com", password: "123", role: "student" }
    ];
        const users = JSON.parse(localStorage.getItem('usersDB') || '[]').filter(user => user.role !== 'instructor');
    defaultUsers.forEach(defaultUser => {
        if (!users.some(user => user.email === defaultUser.email)) users.push(defaultUser);
    });
    localStorage.setItem('usersDB', JSON.stringify(users));
    const activeSession = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
    if (activeSession?.role === 'instructor') localStorage.removeItem('loggedInUser');

    const savedCourses = JSON.parse(localStorage.getItem('lms-courses') || '[]');
    const legacyCourses = JSON.parse(localStorage.getItem('lms-instructor-courses') || '[]');
    const catalog = Array.isArray(savedCourses) ? savedCourses : [];
    if (Array.isArray(legacyCourses)) legacyCourses.forEach(course => {
        if (!catalog.some(item => item.id === course.id || item.title === course.title)) {
            catalog.push({ ...course, id: course.id || `legacy-course-${Date.now()}-${catalog.length}`, assignedStudentEmails: course.assignedStudentEmails || [] });
        }
    });
    catalog.forEach(course => {
        delete course.instructorEmail;
        delete course.instructorName;
        delete course.instructor;
    });
    localStorage.setItem('lms-courses', JSON.stringify(catalog));
    localStorage.removeItem('lms-instructor-courses');

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const role = document.getElementById('role').value;

            if (!['admin', 'student'].includes(role)) {
                alert('Only admin and student accounts are supported.');
                return;
            }

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
            const notifications = JSON.parse(localStorage.getItem('lms-notifications') || '[]');
            notifications.unshift({ text: 'New student registered', detail: `${name} (${email}) created a student account.`, read: false, created: new Date().toISOString() });
            localStorage.setItem('lms-notifications', JSON.stringify(notifications.slice(0, 50)));
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

            if (matchedUser.status === 'inactive' || matchedUser.isActive === false) {
                alert('Your account is inactive. Please contact the administrator.');
                return;
            }

                if (matchedUser.role === 'student') notifyAdminOfStudentLogin(matchedUser);
        
            localStorage.setItem('loggedInUser', JSON.stringify(matchedUser));

       
            const dashboards = {
                admin: 'admin-dashboard/admin.html',
                student: 'student-dashboard/student.html'
            };
            window.location.href = dashboards[matchedUser.role] || '../index.html';
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

function notifyAdminOfStudentLogin(student) {
    try {
        const stored = JSON.parse(localStorage.getItem('lms-notifications') || '[]');
        const notifications = Array.isArray(stored) ? stored : [];
        notifications.unshift({
            text: 'Student signed in',
            detail: `${student.name || 'Student'} (${student.email}) logged in.`,
            read: false,
            created: new Date().toISOString(),
            type: 'student-login'
        });
        localStorage.setItem('lms-notifications', JSON.stringify(notifications.slice(0, 50)));
    } catch {
        alert('Login succeeded, but the admin notification could not be saved in this browser.');
    }
}

function protectRoute(requiredRole) {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    if (!loggedInUser) {
        alert('Access Denied! Please Sign In first.');
        window.location.href = 'signin.html';
        return;
    }

    if (loggedInUser.role !== requiredRole) {
        alert('Unauthorized Access!');
        const dashboards = {
            admin: 'admin-dashboard/admin.html',
            student: 'student-dashboard/student.html'
        };
        window.location.href = dashboards[loggedInUser.role] || '../index.html';
        return;
    }

    const users = JSON.parse(localStorage.getItem('usersDB') || '[]');
    const currentUser = users.find(user => user.email === loggedInUser.email && user.role === requiredRole);
    if (!currentUser || currentUser.status === 'inactive' || currentUser.isActive === false) {
        localStorage.removeItem('loggedInUser');
        alert('Your account is inactive. Please contact the administrator.');
        window.location.href = 'signin.html';
    }
}
