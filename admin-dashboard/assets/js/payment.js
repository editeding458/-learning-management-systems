document.addEventListener('DOMContentLoaded', () => {
    const isStudentPage = Boolean(document.getElementById('studentPaymentForm'));
    const isAdminPage = Boolean(document.getElementById('adminPaymentRows'));
    const user = readStorage('loggedInUser', null);
    if (!user) return;

    const paymentsKey = 'lms-payments';
    const readPayments = () => {
        const value = readStorage(paymentsKey, []);
        return Array.isArray(value) ? value : [];
    };
    const savePayments = (items) => localStorage.setItem(paymentsKey, JSON.stringify(items));

    const makeId = () => {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    };

    const money = value => `$${Number(value || 0).toFixed(2)}`;
    const dateText = value => value ? new Date(value).toLocaleDateString() : '—';
    const escapeValue = value => typeof escapeHTML === 'function' ? escapeHTML(value) : String(value ?? '');

    const studentPayments = () => readPayments().filter(item =>
        item.studentEmail === user.email || String(item.studentId) === String(user.id)
    );

    const notifyStudent = (payment, title, message) => {
        const key = `lms-student-notifications-${payment.studentId || payment.studentEmail || 'student'}`;
        const notices = readStorage(key, []);
        notices.unshift({ title, message, read: false, created: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(notices.slice(0, 50)));
    };

    const loadCourses = () => {
        const select = document.getElementById('paymentCourse');
        if (!select) return;
        const courses = readStorage('lms-courses', []);
        const usable = (Array.isArray(courses) ? courses : []).filter(course => course.status !== 'Draft');
        usable.forEach(course => {
            const option = document.createElement('option');
            option.value = String(course.id ?? course.title ?? '');
            option.textContent = `${course.title || 'Untitled course'} — ${money(String(course.price || '0').replace(/[^\d.]/g, ''))}`;
            option.dataset.title = course.title || 'Course';
            option.dataset.price = String(course.price || '0').replace(/[^\d.]/g, '') || '0';
            select.appendChild(option);
        });
        select.addEventListener('change', () => {
            const selected = select.options[select.selectedIndex];
            const amount = document.getElementById('paymentAmount');
            if (amount && selected?.dataset.price) amount.value = Number(selected.dataset.price).toFixed(2);
        });
    };

    const renderStudent = () => {
        const rows = document.getElementById('studentPaymentRows');
        if (!rows) return;
        const items = studentPayments().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        rows.innerHTML = items.map(item => `
            <tr>
                <td><strong>${escapeValue(item.courseTitle)}</strong></td>
                <td>${money(item.amount)}</td>
                <td>${escapeValue(item.method)}</td>
                <td>${escapeValue(item.transactionId)}</td>
                <td>${dateText(item.createdAt)}</td>
                <td><span class="payment-status payment-${String(item.status).toLowerCase()}">${escapeValue(item.status)}</span></td>
            </tr>
        `).join('');
        document.getElementById('studentPaymentEmpty').hidden = items.length > 0;
        document.getElementById('paymentTotal').textContent = items.length;
        document.getElementById('paymentPending').textContent = items.filter(x => x.status === 'Pending').length;
        document.getElementById('paymentApproved').textContent = items.filter(x => x.status === 'Approved').length;
        document.getElementById('paymentRejected').textContent = items.filter(x => x.status === 'Rejected').length;
    };

    document.getElementById('studentPaymentForm')?.addEventListener('submit', event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const courseSelect = document.getElementById('paymentCourse');
        const selected = courseSelect?.options[courseSelect.selectedIndex];
        const amount = Number(data.get('amount'));
        const status = document.getElementById('paymentFormStatus');

        if (!selected?.value || !amount || amount < 0) {
            status.textContent = 'Please choose a course and enter a valid amount.';
            status.className = 'payment-form-status is-error';
            return;
        }

        const payments = readPayments();
        const duplicate = payments.find(item =>
            item.studentEmail === user.email &&
            item.transactionId?.trim().toLowerCase() === String(data.get('transactionId') || '').trim().toLowerCase()
        );
        if (duplicate) {
            status.textContent = 'This transaction/reference ID has already been submitted.';
            status.className = 'payment-form-status is-error';
            return;
        }

        const payment = {
            id: makeId(),
            studentId: user.id ?? null,
            studentEmail: user.email || '',
            studentName: user.name || 'Student',
            courseId: selected.value,
            courseTitle: selected.dataset.title || selected.textContent.split(' — ')[0],
            amount,
            method: data.get('method'),
            transactionId: String(data.get('transactionId') || '').trim(),
            note: String(data.get('note') || '').trim(),
            status: 'Pending',
            createdAt: new Date().toISOString()
        };
        payments.unshift(payment);
        savePayments(payments);
        if (typeof addAdminNotification === 'function') {
            addAdminNotification(`${payment.studentName} submitted a course payment.`, `${payment.courseTitle} — ${money(payment.amount)}`);
        }
        status.textContent = 'Payment submitted successfully. Waiting for admin approval.';
        status.className = 'payment-form-status is-success';
        form.reset();
        renderStudent();
    });

    const renderAdmin = () => {
        const rows = document.getElementById('adminPaymentRows');
        if (!rows) return;
        const search = String(document.getElementById('paymentSearch')?.value || '').toLowerCase().trim();
        const filter = document.getElementById('paymentStatusFilter')?.value || 'All';
        const all = readPayments();
        const items = all.filter(item => {
            const haystack = `${item.studentName} ${item.studentEmail} ${item.courseTitle} ${item.transactionId} ${item.method}`.toLowerCase();
            return (!search || haystack.includes(search)) && (filter === 'All' || item.status === filter);
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        rows.innerHTML = items.map(item => `
            <tr>
                <td><strong>${escapeValue(item.studentName)}</strong><small>${escapeValue(item.studentEmail)}</small></td>
                <td>${escapeValue(item.courseTitle)}</td>
                <td><strong>${money(item.amount)}</strong></td>
                <td>${escapeValue(item.method)}</td>
                <td>${escapeValue(item.transactionId)}</td>
                <td>${dateText(item.createdAt)}</td>
                <td><span class="payment-status payment-${String(item.status).toLowerCase()}">${escapeValue(item.status)}</span></td>
                <td>${item.status === 'Pending'
                    ? `<div class="payment-actions"><button type="button" data-payment-action="approve" data-payment-id="${escapeValue(item.id)}">Approve</button><button type="button" data-payment-action="reject" data-payment-id="${escapeValue(item.id)}">Reject</button></div>`
                    : '<span class="payment-action-done">Reviewed</span>'}</td>
            </tr>
        `).join('');

        document.getElementById('adminPaymentEmpty').hidden = items.length > 0;
        document.getElementById('adminPaymentTotal').textContent = all.length;
        document.getElementById('adminPaymentPending').textContent = all.filter(x => x.status === 'Pending').length;
        document.getElementById('adminPaymentApproved').textContent = all.filter(x => x.status === 'Approved').length;
        document.getElementById('adminPaymentRejected').textContent = all.filter(x => x.status === 'Rejected').length;
    };

    document.getElementById('adminPaymentRows')?.addEventListener('click', event => {
        const button = event.target.closest('[data-payment-action]');
        if (!button) return;
        const id = button.dataset.paymentId;
        const action = button.dataset.paymentAction;
        const payments = readPayments();
        const item = payments.find(payment => payment.id === id);
        if (!item || item.status !== 'Pending') return;

        item.status = action === 'approve' ? 'Approved' : 'Rejected';
        item.reviewedAt = new Date().toISOString();
        item.reviewedBy = user.email || user.name || 'Admin';
        savePayments(payments);

        notifyStudent(
            item,
            `Payment ${item.status.toLowerCase()}`,
            `Your payment for ${item.courseTitle} (${money(item.amount)}) was ${item.status.toLowerCase()} by the admin.`
        );
        if (typeof showToast === 'function') showToast(`Payment ${item.status.toLowerCase()}.`);
        renderAdmin();
    });

    document.getElementById('paymentSearch')?.addEventListener('input', renderAdmin);
    document.getElementById('paymentStatusFilter')?.addEventListener('change', renderAdmin);
    window.addEventListener('storage', event => {
        if (event.key === paymentsKey) {
            if (isStudentPage) renderStudent();
            if (isAdminPage) renderAdmin();
        }
    });

    if (isStudentPage) {
        loadCourses();
        renderStudent();
    }
    if (isAdminPage) renderAdmin();
});
