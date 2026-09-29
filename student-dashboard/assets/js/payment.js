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
    const savePayments = items => localStorage.setItem(paymentsKey, JSON.stringify(items));
    const money = value => `$${Number(value || 0).toFixed(2)}`;
    const dateText = value => value ? new Date(value).toLocaleDateString() : '—';
    const escapeValue = value => typeof escapeHTML === 'function' ? escapeHTML(value) : String(value ?? '');
    const makeId = () => window.crypto?.randomUUID?.() || `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const downloadReceipt = payment => {
        if (payment.status !== 'Approved') return;

        const issuedAt = payment.reviewedAt ? new Date(payment.reviewedAt).toLocaleString() : dateText(payment.createdAt);
        const receipt = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Payment receipt</title><style>body{font:15px Arial;max-width:720px;margin:40px auto;padding:20px}h1{margin-bottom:6px}table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:10px;border-bottom:1px solid #ddd}td:first-child{color:#667085}button{padding:10px 14px;background:#176b52;color:#fff;border:0}@media print{button{display:none}}</style><body><h1>Tech LMS Payment Bill</h1><p><strong>Bill / Receipt No:</strong> ${escapeValue(payment.id)}</p><p><strong>Approval:</strong> Approved by admin on ${escapeValue(issuedAt)}</p><table><tr><td>Student</td><td>${escapeValue(payment.studentName)}</td></tr><tr><td>Email</td><td>${escapeValue(payment.studentEmail)}</td></tr><tr><td>Course</td><td>${escapeValue(payment.courseTitle)}</td></tr><tr><td>Original amount</td><td>${money(payment.originalAmount || payment.amount)}</td></tr><tr><td>Discount</td><td>${escapeValue(payment.discountCode || '—')}</td></tr><tr><td>Paid amount</td><td>${money(payment.amount)}</td></tr><tr><td>Method</td><td>${escapeValue(payment.method)}</td></tr><tr><td>Reference</td><td>${escapeValue(payment.transactionId || '—')}</td></tr><tr><td>Status</td><td>${escapeValue(payment.status)}</td></tr><tr><td>Reviewed</td><td>${escapeValue(issuedAt)}</td></tr></table><button onclick="window.print()">Print / Save PDF</button></body></html>`;
        const url = URL.createObjectURL(new Blob([receipt], {type:'text/html;charset=utf-8'}));
        const link = document.createElement('a');
        link.href = url;
        link.download = `payment-bill-${String(payment.id).replace(/[^a-z0-9_-]/gi,'-')}.html`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const studentPayments = () => readPayments().filter(item =>
        item.studentEmail === user.email || String(item.studentId) === String(user.id)
    );

    const notifyStudent = (payment, title, message) => {
        const key = `lms-student-notifications-${payment.studentId || payment.studentEmail || 'student'}`;
        const notices = readStorage(key, []);
        notices.unshift({ title, message, read: false, created: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(notices.slice(0, 50)));
    };

    const getCourses = () => {
        const courses = readStorage('lms-courses', []);
        return (Array.isArray(courses) ? courses : []).filter(course => course.status !== 'Draft');
    };

    const getEnrollment = courseId => {
        const enrollments = readStorage('lms-enrollments', []);
        return (Array.isArray(enrollments) ? enrollments : []).find(item =>
            item.email === user.email && String(item.courseId) === String(courseId)
        );
    };

    const getAvailableCoupons = courseId => {
        const coupons = readStorage('lms-admin-coupons', []);
        const now = new Date();
        return (Array.isArray(coupons) ? coupons : []).filter(coupon => {
            if (coupon.status !== 'Active') return false;
            if (coupon.expires && new Date(`${coupon.expires}T23:59:59`) < now) return false;
            if (Number(coupon.uses || 0) >= Number(coupon.limit || Infinity)) return false;
            if (coupon.audience === 'One student' && coupon.studentEmail !== user.email) return false;
            if ((coupon.usedBy || []).includes(user.email)) return false;
            if (coupon.courseId && String(coupon.courseId) !== String(courseId)) return false;
            return true;
        });
    };

    const calculateDiscount = (baseAmount, coupon) => {
        const discountPercent = Math.min(100, Math.max(0, Number.parseFloat(coupon?.discount) || 0));
        return {
            percent: discountPercent,
            amount: Number((Number(baseAmount || 0) * discountPercent / 100).toFixed(2)),
            total: Number(Math.max(0, Number(baseAmount || 0) * (1 - discountPercent / 100)).toFixed(2))
        };
    };

    const couponSelect = document.getElementById('paymentCoupon');
    const discountPreview = document.getElementById('paymentDiscountPreview');

    const renderCouponsForCourse = courseId => {
        if (!couponSelect) return;
        const current = couponSelect.value;
        const coupons = getAvailableCoupons(courseId);
        couponSelect.innerHTML = '<option value="">No coupon / select coupon</option>' +
            coupons.map(coupon => `<option value="${escapeValue(coupon.id)}">${escapeValue(coupon.code)} — ${escapeValue(coupon.discount)}</option>`).join('');
        if (coupons.some(c => c.id === current)) couponSelect.value = current;
    };

    const updatePaymentTotal = () => {
        const courseSelect = document.getElementById('paymentCourse');
        const amount = document.getElementById('paymentAmount');
        const original = document.getElementById('paymentOriginalAmount');
        const selected = courseSelect?.options[courseSelect.selectedIndex];
        if (!selected?.value) {
            if (amount) amount.value = '';
            if (original) original.textContent = '$0.00';
            if (discountPreview) discountPreview.textContent = 'Choose a course to see available coupons.';
            return;
        }

        const coursePrice = Number(selected.dataset.price || 0);
        const enrollment = getEnrollment(selected.value);
        const coupon = getAvailableCoupons(selected.value).find(item => item.id === couponSelect?.value);
        const result = coupon ? calculateDiscount(coursePrice, coupon) : { percent: 0, amount: 0, total: coursePrice };

        // If a coupon was previously applied from the Coupons page, preserve that discounted enrollment amount.
        const storedDiscounted = enrollment?.discountCode && Number.isFinite(Number(enrollment.amount))
            ? Number(enrollment.amount)
            : null;
        const total = coupon ? result.total : (storedDiscounted !== null ? storedDiscounted : coursePrice);
        if (amount) amount.value = total.toFixed(2);
        const methodField = document.querySelector('#studentPaymentForm [name="method"]');
        if (methodField && total === 0) methodField.value = 'Coupon / Free';
        if (methodField && total > 0 && methodField.value === 'Coupon / Free') methodField.value = '';
        if (original) original.textContent = money(coursePrice);
        if (discountPreview) {
            discountPreview.innerHTML = coupon
                ? `<strong>${escapeValue(coupon.code)}</strong> saves ${money(result.amount)} (${result.percent}%) — Pay ${money(result.total)}`
                : (storedDiscounted !== null && enrollment.discountCode
                    ? `<strong>${escapeValue(enrollment.discountCode)}</strong> already applied — Pay ${money(total)}`
                    : 'Select a coupon to apply an available discount.');
        }
    };

    const loadCourses = () => {
        const select = document.getElementById('paymentCourse');
        if (!select) return;
        select.innerHTML = '<option value="">Choose a course</option>';
        getCourses().forEach(course => {
            const price = Number(String(course.price || '0').replace(/[^\d.]/g, '') || 0);
            const option = document.createElement('option');
            option.value = String(course.id ?? course.title ?? '');
            option.textContent = `${course.title || 'Untitled course'} — ${money(price)}`;
            option.dataset.title = course.title || 'Course';
            option.dataset.price = String(price);
            select.appendChild(option);
        });
        select.addEventListener('change', () => {
            renderCouponsForCourse(select.value);
            updatePaymentTotal();
        });
        couponSelect?.addEventListener('change', updatePaymentTotal);
        const requestedCourse = new URLSearchParams(window.location.search).get('course');
        if (requestedCourse && [...select.options].some(option => option.value === requestedCourse)) {
            select.value = requestedCourse;
            renderCouponsForCourse(requestedCourse);
        }
        updatePaymentTotal();
    };

    const renderStudent = () => {
        const rows = document.getElementById('studentPaymentRows');
        if (!rows) return;
        const items = studentPayments().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        rows.innerHTML = items.map(item => `
            <tr>
                <td><strong>${escapeValue(item.courseTitle)}</strong>${item.discountCode ? `<small>Coupon: ${escapeValue(item.discountCode)}</small>` : ''}</td>
                <td>${item.originalAmount && Number(item.originalAmount) !== Number(item.amount) ? `<del>${money(item.originalAmount)}</del> ` : ''}<strong>${money(item.amount)}</strong></td>
                <td>${escapeValue(item.method)}</td>
                <td>${escapeValue(item.transactionId)}</td>
                <td>${dateText(item.createdAt)}</td>
                <td><span class="payment-status payment-${String(item.status).toLowerCase()}">${escapeValue(item.status)}</span></td>
                <td>${item.status === 'Approved' && typeof downloadReceipt === 'function' ? `<button class="payment-receipt-btn" type="button" data-payment-receipt="${escapeValue(item.id)}"><i class="fa-solid fa-download"></i> Download Bill</button>` : 'Available after admin approval'}</td>
            </tr>
        `).join('');
        const empty = document.getElementById('studentPaymentEmpty');
        if (empty) empty.hidden = items.length > 0;
        document.getElementById('paymentTotal')?.replaceChildren(document.createTextNode(String(items.length)));
        document.getElementById('paymentPending')?.replaceChildren(document.createTextNode(String(items.filter(x => x.status === 'Pending').length)));
        document.getElementById('paymentApproved')?.replaceChildren(document.createTextNode(String(items.filter(x => x.status === 'Approved').length)));
        document.getElementById('paymentRejected')?.replaceChildren(document.createTextNode(String(items.filter(x => x.status === 'Rejected').length)));
    };

    document.getElementById('studentPaymentForm')?.addEventListener('submit', event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const courseSelect = document.getElementById('paymentCourse');
        const selected = courseSelect?.options[courseSelect.selectedIndex];
        const status = document.getElementById('paymentFormStatus');
        const amount = Number(data.get('amount'));
        const coupon = getAvailableCoupons(selected?.value).find(item => item.id === data.get('couponId'));

        if (!selected?.value || !Number.isFinite(amount) || amount < 0) {
            status.textContent = 'Please choose a course and enter a valid amount.';
            status.className = 'payment-form-status is-error';
            return;
        }
        if (coupon) {
            const expected = calculateDiscount(Number(selected.dataset.price || 0), coupon).total;
            if (Math.abs(expected - amount) > 0.01) {
                status.textContent = 'Coupon discount changed. Please reselect the coupon.';
                status.className = 'payment-form-status is-error';
                updatePaymentTotal();
                return;
            }
        }

        const payments = readPayments();
        const transaction = String(data.get('transactionId') || '').trim();
        if (amount > 0 && !transaction) {
            status.textContent = 'Transaction / Reference ID is required for paid courses.';
            status.className = 'payment-form-status is-error';
            return;
        }
        const duplicate = payments.find(item =>
            item.studentEmail === user.email && transaction &&
            item.transactionId?.trim().toLowerCase() === transaction.toLowerCase()
        );
        if (duplicate) {
            status.textContent = 'This transaction/reference ID has already been submitted.';
            status.className = 'payment-form-status is-error';
            return;
        }

        const now = new Date().toISOString();
        const payment = {
            id: makeId(),
            studentId: user.id ?? null,
            studentEmail: user.email || '',
            studentName: user.name || 'Student',
            courseId: selected.value,
            courseTitle: selected.dataset.title || 'Course',
            originalAmount: Number(selected.dataset.price || 0),
            amount,
            discountCode: coupon?.code || '',
            discountPercent: coupon ? Number.parseFloat(coupon.discount) || 0 : 0,
            method: data.get('method') || 'Coupon / Free',
            transactionId: transaction,
            note: String(data.get('note') || '').trim(),
            status: amount === 0 ? 'Approved' : 'Pending',
            createdAt: now
        };
        payments.unshift(payment);
        savePayments(payments);

        const enrollments = readStorage('lms-enrollments', []);
        const safeEnrollments = Array.isArray(enrollments) ? enrollments : [];
        let enrollment = safeEnrollments.find(item => item.email === user.email && String(item.courseId) === String(payment.courseId));
        if (!enrollment) {
            enrollment = { id: `enrollment-${payment.id}`, student: payment.studentName, email: payment.studentEmail, course: payment.courseTitle, courseId: payment.courseId, created: now };
            safeEnrollments.unshift(enrollment);
        }
        Object.assign(enrollment, {
            amount,
            originalAmount: payment.originalAmount,
            discountCode: payment.discountCode,
            paymentId: payment.id,
            status: payment.status === 'Approved' ? 'Paid' : 'Pending',
            paidAt: payment.status === 'Approved' ? now : enrollment.paidAt
        });
        localStorage.setItem('lms-enrollments', JSON.stringify(safeEnrollments));

        if (coupon) {
            const coupons = readStorage('lms-admin-coupons', []);
            const savedCoupon = Array.isArray(coupons) ? coupons.find(item => item.id === coupon.id) : null;
            if (savedCoupon) {
                savedCoupon.usedBy = Array.isArray(savedCoupon.usedBy) ? savedCoupon.usedBy : [];
                if (!savedCoupon.usedBy.includes(user.email)) savedCoupon.usedBy.push(user.email);
                savedCoupon.uses = Number(savedCoupon.uses || 0) + 1;
                localStorage.setItem('lms-admin-coupons', JSON.stringify(coupons));
            }
        }

        if (typeof addAdminNotification === 'function') {
            addAdminNotification(`${payment.studentName} submitted a course payment.`, `${payment.courseTitle} — ${money(payment.amount)}${payment.discountCode ? ` (${payment.discountCode})` : ''}`);
        }
        status.textContent = payment.status === 'Approved'
            ? 'Payment completed. Your course sessions are unlocked. Open My Courses and click Start Learning.'
            : 'Payment submitted successfully. After admin approval, your course sessions will unlock in My Courses.';
        status.className = 'payment-form-status is-success';
        form.reset();
        if (couponSelect) couponSelect.innerHTML = '<option value="">No coupon / select coupon</option>';
        updatePaymentTotal();
        renderStudent();
    });

    const openEditDialog = item => {
        if (document.getElementById('paymentEditDialog')) document.getElementById('paymentEditDialog').remove();
        const dialog = document.createElement('dialog');
        dialog.id = 'paymentEditDialog';
        dialog.innerHTML = `<form method="dialog" class="payment-edit-dialog-form">
            <h2>Edit payment</h2>
            <p>${escapeValue(item.studentName)} · ${escapeValue(item.courseTitle)}</p>
            <label>Amount<input name="amount" type="number" min="0" step="0.01" value="${Number(item.amount || 0).toFixed(2)}" required></label>
            <label>Method<select name="method"><option ${item.method==='UPI'?'selected':''}>UPI</option><option ${item.method==='Card'?'selected':''}>Card</option><option ${item.method==='Bank Transfer'?'selected':''}>Bank Transfer</option><option ${item.method==='Cash'?'selected':''}>Cash</option><option ${item.method==='Coupon / Free'?'selected':''}>Coupon / Free</option></select></label>
            <label>Reference ID<input name="transactionId" value="${escapeValue(item.transactionId || '')}"></label>
            <label>Status<select name="status"><option ${item.status==='Pending'?'selected':''}>Pending</option><option ${item.status==='Approved'?'selected':''}>Approved</option><option ${item.status==='Rejected'?'selected':''}>Rejected</option></select></label>
            <label>Note<textarea name="note" rows="3">${escapeValue(item.note || '')}</textarea></label>
            <div class="payment-edit-actions"><button value="cancel" type="submit">Cancel</button><button value="save" class="payment-primary-btn" type="submit">Save changes</button></div>
        </form>`;
        document.body.appendChild(dialog);
        dialog.showModal();
        dialog.querySelector('form').addEventListener('submit', e => {
            if (e.submitter?.value !== 'save') return;
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const previous = item.status;
            item.amount = Number(data.get('amount') || 0);
            item.method = String(data.get('method') || '');
            item.transactionId = String(data.get('transactionId') || '').trim();
            item.note = String(data.get('note') || '').trim();
            item.status = String(data.get('status') || 'Pending');
            item.editedAt = new Date().toISOString();
            item.editedBy = user.email || user.name || 'Admin';

            const payments = readPayments();
            const index = payments.findIndex(p => p.id === item.id);
            if (index >= 0) payments[index] = item;
            savePayments(payments);

            const enrollments = readStorage('lms-enrollments', []);
            const safe = Array.isArray(enrollments) ? enrollments : [];
            let enrollment = safe.find(e => e.email === item.studentEmail && String(e.courseId) === String(item.courseId));
            if (!enrollment) {
                enrollment = { id: `enrollment-${item.id}`, student: item.studentName, email: item.studentEmail, course: item.courseTitle, courseId: item.courseId, created: item.createdAt };
                safe.unshift(enrollment);
            }
            Object.assign(enrollment, {
                amount: Number(item.amount),
                status: item.status === 'Approved' ? 'Paid' : item.status === 'Rejected' ? 'Rejected' : 'Pending',
                paymentId: item.id,
                paidAt: item.status === 'Approved' ? (item.reviewedAt || new Date().toISOString()) : enrollment.paidAt
            });
            localStorage.setItem('lms-enrollments', JSON.stringify(safe));

            if (previous !== item.status) notifyStudent(item, `Payment ${item.status.toLowerCase()}`, `Your payment for ${item.courseTitle} is now ${item.status.toLowerCase()}.`);
            dialog.close();
            dialog.remove();
            renderAdmin();
        });
        dialog.addEventListener('close', () => dialog.remove(), { once: true });
    };

    const renderAdmin = () => {
        const rows = document.getElementById('adminPaymentRows');
        if (!rows) return;
        const search = String(document.getElementById('paymentSearch')?.value || '').toLowerCase().trim();
        const filter = document.getElementById('paymentStatusFilter')?.value || 'All';
        const all = readPayments();
        const items = all.filter(item => {
            const haystack = `${item.studentName} ${item.studentEmail} ${item.courseTitle} ${item.transactionId} ${item.method} ${item.discountCode || ''}`.toLowerCase();
            return (!search || haystack.includes(search)) && (filter === 'All' || item.status === filter);
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        rows.innerHTML = items.map(item => `
            <tr>
                <td><strong>${escapeValue(item.studentName)}</strong><small>${escapeValue(item.studentEmail)}</small></td>
                <td>${escapeValue(item.courseTitle)}${item.discountCode ? `<small>Coupon: ${escapeValue(item.discountCode)}</small>` : ''}</td>
                <td>${item.originalAmount && Number(item.originalAmount) !== Number(item.amount) ? `<del>${money(item.originalAmount)}</del> ` : ''}<strong>${money(item.amount)}</strong></td>
                <td>${escapeValue(item.method)}</td>
                <td>${escapeValue(item.transactionId || '—')}</td>
                <td>${dateText(item.createdAt)}</td>
                <td><span class="payment-status payment-${String(item.status).toLowerCase()}">${escapeValue(item.status)}</span></td>
                <td><div class="payment-actions">${item.status === 'Pending' ? `<button type="button" data-payment-action="approve" data-payment-id="${escapeValue(item.id)}">Approve</button><button type="button" data-payment-action="reject" data-payment-id="${escapeValue(item.id)}">Reject</button>` : ''}<button type="button" class="payment-edit-btn" data-payment-action="edit" data-payment-id="${escapeValue(item.id)}">Edit</button></div></td>
            </tr>
        `).join('');

        document.getElementById('adminPaymentEmpty').hidden = items.length > 0;
        document.getElementById('adminPaymentTotal').textContent = all.length;
        document.getElementById('adminPaymentPending').textContent = all.filter(x => x.status === 'Pending').length;
        document.getElementById('adminPaymentApproved').textContent = all.filter(x => x.status === 'Approved').length;
        document.getElementById('adminPaymentRejected').textContent = all.filter(x => x.status === 'Rejected').length;
    };

    document.getElementById('studentPaymentRows')?.addEventListener('click', event => {
        const button = event.target.closest('[data-payment-receipt]');
        if (!button) return;
        const payment = studentPayments().find(item => item.id === button.dataset.paymentReceipt);
        if (!payment || payment.status !== 'Approved') {
            if (typeof showToast === 'function') showToast('Bill is available only after admin approval.');
            return;
        }
        downloadReceipt(payment);
    });

    document.getElementById('adminPaymentRows')?.addEventListener('click', event => {
        const button = event.target.closest('[data-payment-action]');
        if (!button) return;
        const id = button.dataset.paymentId;
        const action = button.dataset.paymentAction;
        const payments = readPayments();
        const item = payments.find(payment => payment.id === id);
        if (!item) return;

        if (action === 'edit') {
            openEditDialog(item);
            return;
        }
        if (item.status !== 'Pending') return;

        item.status = action === 'approve' ? 'Approved' : 'Rejected';
        item.reviewedAt = new Date().toISOString();
        item.reviewedBy = user.email || user.name || 'Admin';
        savePayments(payments);

        const enrollments = readStorage('lms-enrollments', []);
        const safe = Array.isArray(enrollments) ? enrollments : [];
        const enrollment = safe.find(record => record.email === item.studentEmail && String(record.courseId) === String(item.courseId));
        if (enrollment) {
            enrollment.amount = Number(item.amount);
            enrollment.status = item.status === 'Approved' ? 'Paid' : 'Rejected';
            if (item.status === 'Approved') enrollment.paidAt = item.reviewedAt;
            localStorage.setItem('lms-enrollments', JSON.stringify(safe));
        }

        notifyStudent(item, `Payment ${item.status.toLowerCase()}`, `Your payment for ${item.courseTitle} (${money(item.amount)}) was ${item.status.toLowerCase()} by the admin.`);
        if (typeof showToast === 'function') showToast(`Payment ${item.status.toLowerCase()}.`);
        renderAdmin();
    });

    document.getElementById('paymentSearch')?.addEventListener('input', renderAdmin);
    document.getElementById('paymentStatusFilter')?.addEventListener('change', renderAdmin);
    window.addEventListener('storage', event => {
        if (event.key === paymentsKey || event.key === 'lms-enrollments' || event.key === 'lms-admin-coupons') {
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
