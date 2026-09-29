(() => {
    const KEY = 'lms-support-tickets';
    const read = (key, fallback = []) => {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    };
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const esc = value => typeof escapeHTML === 'function' ? escapeHTML(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const id = () => window.crypto?.randomUUID?.() || `ticket-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

    const migrate = () => {
        const current = read(KEY, []);
        if (Array.isArray(current) && current.length) return current;
        const legacyA = read('lms-admin-support', []);
        const legacyB = read('lms-reports', []);
        const merged = [
            ...(Array.isArray(legacyA) ? legacyA : []),
            ...(Array.isArray(legacyB) ? legacyB : [])
        ].map(item => ({
            id: item.id || id(),
            subject: item.subject || item.title || 'Support request',
            category: item.category || 'Other',
            details: item.details || item.description || '',
            email: item.email || item.studentEmail || '',
            reporterName: item.reporterName || item.studentName || 'Student',
            reporterRole: item.reporterRole || 'Student',
            created: item.created || new Date().toISOString(),
            status: item.status === 'Resolved' ? 'Resolved' : 'Open',
            reply: item.reply || item.adminReply || '',
            repliedAt: item.repliedAt || null
        }));
        if (merged.length) write(KEY, merged);
        return merged;
    };

    const getTickets = () => {
        const tickets = migrate();
        return Array.isArray(tickets) ? tickets : [];
    };

    const notifyStudent = (ticket, title, message) => {
        const key = `lms-student-notifications-${ticket.studentId || ticket.email || 'student'}`;
        const notices = read(key, []);
        notices.unshift({ title, message, read: false, created: new Date().toISOString() });
        write(key, notices.slice(0, 50));
    };

    const renderStudentTickets = () => {
        const list = document.getElementById('studentSupportTickets');
        const user = read('loggedInUser', null);
        if (!list || !user) return;
        const tickets = getTickets().filter(ticket => ticket.email === user.email || String(ticket.studentId) === String(user.id));
        list.innerHTML = tickets.length ? tickets.map(ticket => `
            <article class="support-ticket-card">
                <div><strong>${esc(ticket.subject)}</strong><span class="support-ticket-status ${ticket.status === 'Resolved' ? 'is-resolved' : 'is-open'}">${esc(ticket.status)}</span></div>
                <p>${esc(ticket.category)} · ${esc(ticket.created ? new Date(ticket.created).toLocaleString() : '')}</p>
                <p>${esc(ticket.details)}</p>
                ${ticket.reply ? `<div class="support-ticket-reply"><strong>Admin reply</strong><p>${esc(ticket.reply)}</p><small>${esc(ticket.repliedAt ? new Date(ticket.repliedAt).toLocaleString() : '')}</small></div>` : '<small>Waiting for admin response.</small>'}
            </article>
        `).join('') : '<p class="student-record-empty">You have not submitted any support ticket yet.</p>';
    };

    const initStudent = () => {
        const form = document.querySelector('[data-issue-report-form]');
        const user = read('loggedInUser', null);
        if (!form || !user || user.role !== 'student') return;
        form.addEventListener('submit', event => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(form).entries());
            const ticket = {
                id: id(),
                studentId: user.id || null,
                subject: String(values.subject || '').trim(),
                category: values.category || 'Other',
                details: String(values.details || '').trim(),
                email: user.email || '',
                reporterName: user.name || 'Student',
                reporterRole: 'Student',
                created: new Date().toISOString(),
                status: 'Open',
                reply: '',
                repliedAt: null
            };
            if (!ticket.subject || !ticket.details) return;
            const tickets = getTickets();
            tickets.unshift(ticket);
            write(KEY, tickets.slice(0, 200));
            const notifications = read('lms-notifications', []);
            notifications.unshift({ text: `New support ticket from ${ticket.reporterName}`, detail: `${ticket.subject} · ${ticket.category}`, read: false, created: ticket.created });
            write('lms-notifications', notifications.slice(0, 50));
            form.reset();
            const status = form.querySelector('[data-issue-report-status]');
            if (status) status.textContent = 'Ticket submitted. You can track the admin reply below.';
            renderStudentTickets();
        });
        renderStudentTickets();
    };

    const initAdmin = () => {
        const tableBody = document.getElementById('adminSupportTableBody');
        if (!tableBody) return;
        const render = () => {
            const tickets = getTickets().sort((a,b) => new Date(b.created) - new Date(a.created));
            tableBody.innerHTML = tickets.length ? tickets.map(ticket => `
                <tr>
                    <td>${esc(ticket.reporterName)}<small>${esc(ticket.email)}</small></td>
                    <td>${esc(ticket.category)}</td>
                    <td><strong>${esc(ticket.subject)}</strong><p>${esc(ticket.details)}</p>${ticket.reply ? `<div class="admin-ticket-reply"><strong>Reply:</strong> ${esc(ticket.reply)}</div>` : ''}</td>
                    <td><span class="support-ticket-status ${ticket.status === 'Resolved' ? 'is-resolved' : 'is-open'}">${esc(ticket.status)}</span></td>
                    <td><button type="button" class="button button-primary support-reply-btn" data-support-reply="${esc(ticket.id)}">${ticket.status === 'Resolved' ? 'Reply again' : 'Reply / Resolve'}</button></td>
                </tr>
            `).join('') : '<tr><td colspan="5">No support tickets yet.</td></tr>';
        };
        tableBody.addEventListener('click', event => {
            const button = event.target.closest('[data-support-reply]');
            if (!button) return;
            const tickets = getTickets();
            const ticket = tickets.find(item => item.id === button.dataset.supportReply);
            if (!ticket) return;
            const reply = window.prompt(`Reply to ${ticket.reporterName}:`, ticket.reply || '');
            if (reply === null) return;
            ticket.reply = reply.trim();
            ticket.repliedAt = new Date().toISOString();
            ticket.status = 'Resolved';
            write(KEY, tickets);
            notifyStudent(ticket, 'Support ticket updated', `${ticket.subject}: ${ticket.reply || 'Your ticket was marked resolved.'}`);
            render();
        });
        render();
        window.addEventListener('storage', event => { if (event.key === KEY || event.key === 'lms-admin-support' || event.key === 'lms-reports') render(); });
    };

    document.addEventListener('DOMContentLoaded', () => {
        initStudent();
        initAdmin();
    });
})();