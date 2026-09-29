document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('adminProfileForm');
    if (!form) return;

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = document.getElementById('adminNameInput')?.value.trim() || '';
        const email = document.getElementById('adminEmailInput')?.value.trim() || '';
        let user;
        try {
            user = JSON.parse(localStorage.getItem('loggedInUser')) || { role: 'admin' };
        } catch (error) {
            user = { role: 'admin' };
        }
        user.name = name;
        user.email = email;
        localStorage.setItem('loggedInUser', JSON.stringify(user));
        alert('Profile updated successfully!');
        window.location.reload();
    });
});
