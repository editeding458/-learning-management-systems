document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('reportIssueForm');
    const reportStatus = document.getElementById('reportIssueStatus');
    const adminReportContainer = document.getElementById('adminReportList');

    // Student: Submit Issue
    reportForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = readStorage('loggedInUser', null);
        if (!user) {
            alert('Please sign in first.');
            return;
        }

        const formData = new FormData(reportForm);
        const title = formData.get('title')?.trim();
        const category = formData.get('category');
        const description = formData.get('description')?.trim();

        if (!title || !description) {
            if (reportStatus) reportStatus.textContent = 'Please fill in all required fields.';
            return;
        }

        const reports = readStorage('lms-reports', []);
        const newReport = {
            id: `report-${Date.now()}`,
            studentEmail: user.email,
            studentName: user.name || 'Student',
            title,
            category: category || 'General',
            description,
            status: 'Pending',
            created: new Date().toISOString()
        };

        reports.unshift(newReport);
        localStorage.setItem('lms-reports', JSON.stringify(reports));
        addAdminNotification(`New issue reported by ${newReport.studentName}`, `${title} (${category})`);

        reportForm.reset();
        if (reportStatus) reportStatus.textContent = 'Issue reported successfully to the admin.';
        setTimeout(() => { if (reportStatus) reportStatus.textContent = ''; }, 4000);
    });

    // Admin: Render Reports
    if (adminReportContainer) {
        const renderAdminReports = () => {
            const reports = readStorage('lms-reports', []);
            adminReportContainer.innerHTML = reports.length ? reports.map(item => `
                <article class="student-record" data-report-id="${escapeHTML(item.id)}">
                    <strong>${escapeHTML(item.title)} (${escapeHTML(item.category)})</strong>
                    <p>By: <strong>${escapeHTML(item.studentName)}</strong> (${escapeHTML(item.studentEmail)})</p>
                    <p>${escapeHTML(item.description)}</p>
                    <time>${escapeHTML(new Date(item.created).toLocaleString())}</time>
                    <div style="margin-top:6px;">
                        <span class="status-pill ${item.status === 'Resolved' ? 'status-active' : 'status-pending'}">${escapeHTML(item.status)}</span>
                        ${item.status !== 'Resolved' ? `<button type="button" class="btn-resume" data-resolve-report="${escapeHTML(item.id)}" style="margin-left:8px;">Mark Resolved</button>` : ''}
                    </div>
                </article>
            `).join('') : '<p class="student-record-empty">No issues reported yet.</p>';
        };

        renderAdminReports();
        adminReportContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-resolve-report]');
            if (!btn) return;
            const reportId = btn.dataset.resolveReport;
            const reports = readStorage('lms-reports', []);
            const report = reports.find(r => r.id === reportId);
            if (report) {
                report.status = 'Resolved';
                localStorage.setItem('lms-reports', JSON.stringify(reports));
                renderAdminReports();
            }
        });
        window.addEventListener('storage', (e) => {
            if (e.key === 'lms-reports') renderAdminReports();
        });
    }
});