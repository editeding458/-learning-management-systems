(() => {
    try {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        if (!user || user.role !== 'admin') {
            window.location.replace('../signin.html');
        }
    } catch (error) {
        localStorage.removeItem('loggedInUser');
        window.location.replace('../signin.html');
    }
})();
