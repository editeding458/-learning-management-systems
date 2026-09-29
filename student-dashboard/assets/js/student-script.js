function formatElapsedDuration(startTime, endTime = Date.now()) {
    const totalSeconds = Math.max(0, Math.floor((endTime - new Date(startTime).getTime()) / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!initializeSession('student')) return;
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    if (sidebarClose && sidebar) {
        sidebarClose.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }

    const user = readStorage('loggedInUser', null);
    initializeStudentFeatures(user);
    initializeProfileNavigation('settings.html');
    document.querySelectorAll('.user-profile span').forEach(name => {
        name.textContent = user?.name || 'Student';
    });
    document.querySelectorAll('[data-student-name]').forEach(name => {
        name.textContent = user?.name || 'Student';
    });
    const welcomeHeading = document.querySelector('.dash-header h2');
    if (welcomeHeading?.textContent.toLowerCase().includes('welcome back')) {
        welcomeHeading.textContent = `Welcome back, ${user?.name || 'Student'}!`;
    }
    document.querySelectorAll('.user-profile img').forEach(image => {
        image.alt = `${user?.name || 'Student'} profile`;
    });
    document.querySelectorAll('.sidebar-menu a[href="../index.html"]').forEach(link => {
        link.addEventListener('click', () => localStorage.removeItem('loggedInUser'));
    });

    const publishedCourseList = document.getElementById('publishedCourseList');
    if (publishedCourseList) {
        const renderPublishedCourses = () => {
            const courses = readStorage('lms-courses', []);
            const publishedCourses = (Array.isArray(courses) ? courses : []).filter(course => {
                const assignedEmails = Array.isArray(course.assignedStudentEmails) ? course.assignedStudentEmails : [];
                const assignedIds = Array.isArray(course.assignedStudentIds) ? course.assignedStudentIds.map(String) : [];
                return course.status === 'Published' && (assignedEmails.includes(user?.email) || assignedIds.includes(String(user?.id)));
            });
            publishedCourseList.replaceChildren();
            if (!publishedCourses.length) {
                const empty = document.createElement('p');
                empty.className = 'student-catalog-empty';
                empty.textContent = 'No new courses are available yet.';
                publishedCourseList.appendChild(empty);
                return;
            }

            publishedCourses.slice().reverse().forEach(course => {
                const card = document.createElement('article');
                card.className = 'student-catalog-card';
                const image = document.createElement('img');
                image.src = course.image || '../assets/image/images (2).jfif';
                image.alt = `${course.title || 'Course'} cover`;
                image.loading = 'lazy';
                const details = document.createElement('div');
                details.className = 'student-catalog-details';
                const category = document.createElement('span');
                category.className = 'cat';
                category.textContent = course.category || 'General';
                const title = document.createElement('h4');
                title.textContent = course.title || 'New course';
                const footer = document.createElement('div');
                footer.className = 'student-catalog-footer';
                const price = document.createElement('strong');
                price.textContent = `$${Number(String(course.price || '0').replace(/[^\d.]/g, '') || 0).toFixed(2)}`;
                const published = document.createElement('span');
                published.className = 'catalog-published';
                published.textContent = 'Published';
                footer.append(price, published);
                details.append(category, title, footer);
                card.append(image, details);
                publishedCourseList.appendChild(card);
            });
        };
        renderPublishedCourses();
        window.addEventListener('storage', event => event.key === 'lms-courses' && renderPublishedCourses());
    }

    const notification = document.querySelector('.notification');
    if (notification) {
        notification.setAttribute('role', 'button');
        notification.setAttribute('tabindex', '0');
        const panel = document.createElement('div');
        panel.className = 'student-notification-menu';
        panel.hidden = true;
        const notificationKey = `lms-student-notifications-${user?.id || user?.email || 'student'}`;
        const renderNotifications = () => {
            const stored = readStorage(notificationKey, []);
            const notifications = Array.isArray(stored) ? stored : [];
            panel.innerHTML = `<h3>Notifications</h3>${notifications.length ? notifications.map(item => `<p class="${item.read ? 'is-read' : ''}"><i class="fa-solid fa-bell"></i><strong>${escapeHTML(item.title || 'Update')}</strong><br>${escapeHTML(item.message || '')}</p>`).join('') : '<p>No new updates.</p>'}<div class="student-notification-actions"><button type="button" data-student-notification-read>Mark all read</button><button type="button" data-student-notification-clear>Clear all</button></div>`;
            const unread = notifications.filter(item => !item.read).length;
            notification.querySelector('.badge')?.replaceChildren(document.createTextNode(String(unread)));
        };
        renderNotifications();
        notification.parentElement.appendChild(panel);
        const toggleNotifications = () => { panel.hidden = !panel.hidden; };
        notification.addEventListener('click', toggleNotifications);
        notification.addEventListener('keydown', event => {
            if (['Enter', ' '].includes(event.key)) { event.preventDefault(); toggleNotifications(); }
        });
        panel.addEventListener('click', event => {
            const notices = readStorage(notificationKey, []);
            if (event.target.closest('[data-student-notification-clear]')) localStorage.setItem(notificationKey, '[]');
            else if (event.target.closest('[data-student-notification-read]')) localStorage.setItem(notificationKey, JSON.stringify((Array.isArray(notices) ? notices : []).map(item => ({ ...item, read: true }))));
            else return;
            renderNotifications();
        });
        window.addEventListener('lms-student-notifications-updated', renderNotifications);
        window.addEventListener('storage', event => event.key === notificationKey && renderNotifications());
    }

    const adminNotificationKey = `lms-student-notifications-${user?.id || user?.email || 'student'}`;
    const renderAdminUpdates = () => {
        const adminUpdates = readStorage(adminNotificationKey, []).slice(0, 3);
        let section = document.getElementById('adminUpdates');
        if (!adminUpdates.length) {
            section?.remove();
            return;
        }
        if (!section) {
            section = document.createElement('section');
            section.className = 'widget-box admin-updates';
            section.id = 'adminUpdates';
            document.querySelector('.dash-body')?.prepend(section);
        }
        section.innerHTML = `<h3>Updates from Tech LMS</h3>${adminUpdates.map(item => `<p><strong>${escapeHTML(item.title || 'Update')}</strong><br>${escapeHTML(item.message || '')}</p>`).join('')}`;
    };
    renderAdminUpdates();
    window.addEventListener('storage', event => {
        if (event.key === adminNotificationKey) renderAdminUpdates();
    });

    const attendanceStatus = document.getElementById('attendanceStatus');
    const todaySummary = document.getElementById('todaySummary');
    const lastAttendance = document.getElementById('lastAttendance');
    const attendanceDuration = document.getElementById('attendanceDuration');
    const attendanceTable = document.getElementById('attendanceTableBody');
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');
    const attendanceStorageKey = `studentAttendanceLog-${encodeURIComponent(String(user?.id || user?.email || 'student'))}`;

    const loadAttendance = () => {
        const storedEntries = readStorage(attendanceStorageKey, null);
        if (Array.isArray(storedEntries)) return storedEntries;
        const legacyEntries = readStorage('studentAttendanceLog', []);
        if (Array.isArray(legacyEntries) && legacyEntries.length) {
            localStorage.setItem(attendanceStorageKey, JSON.stringify(legacyEntries));
            localStorage.removeItem('studentAttendanceLog');
            return legacyEntries;
        }
        return [];
    };

    const saveAttendance = (entries) => {
        localStorage.setItem(attendanceStorageKey, JSON.stringify(entries));
    };

    const renderAttendance = () => {
        const entries = loadAttendance();
        const validEntries = entries.filter(entry => entry && entry.status && entry.time);
        const lastEntry = validEntries[validEntries.length - 1] || null;
        const today = new Date().toDateString();
        const todayEntries = validEntries.filter(entry => new Date(entry.time).toDateString() === today);
        const todayLastEntry = todayEntries[todayEntries.length - 1] || null;
        const isCurrentlyCheckedIn = lastEntry?.status === 'Checked In';

        if (attendanceStatus) {
            if (isCurrentlyCheckedIn) {
                attendanceStatus.textContent = 'Checked In';
                attendanceStatus.className = 'status-pill status-active';
            } else if (todayLastEntry?.status === 'Checked Out') {
                attendanceStatus.textContent = 'Checked Out';
                attendanceStatus.className = 'status-pill status-pending';
            } else {
                attendanceStatus.textContent = 'Not checked in';
                attendanceStatus.className = 'status-pill status-inactive';
            }
        }

        if (todaySummary) {
            todaySummary.textContent = `${todayEntries.length} record(s)`;
        }

        if (lastAttendance) {
            lastAttendance.textContent = lastEntry ? new Date(lastEntry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
        }

        if (attendanceDuration) {
            attendanceDuration.textContent = isCurrentlyCheckedIn
                ? formatElapsedDuration(lastEntry.time)
                : '00:00:00';
        }

        if (attendanceTable) {
            attendanceTable.innerHTML = validEntries.slice().reverse().map(entry => `
                <tr>
                    <td>${entry.status}</td>
                    <td>${new Date(entry.time).toLocaleDateString()}</td>
                    <td>${new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
            `).join('') || '<tr><td colspan="3">No attendance history yet.</td></tr>';
        }
    };

    const addAttendanceEntry = (status) => {
        const entries = loadAttendance();
        const lastEntry = entries.filter(entry => entry?.status && entry?.time).at(-1);
        if (status === 'Checked In' && lastEntry?.status === 'Checked In') {
            alert('You are already checked in. Check out before starting another session.');
            return;
        }
        if (status === 'Checked Out' && lastEntry?.status !== 'Checked In') {
            alert('You must check in before checking out.');
            return;
        }

        entries.push({ status, time: new Date().toISOString() });
        saveAttendance(entries);
        addAdminNotification(`${user?.name || 'A student'} ${status.toLowerCase()}.`, `${user?.email || ''} submitted attendance.`);
        renderAttendance();
    };

    checkInBtn?.addEventListener('click', () => addAttendanceEntry('Checked In'));
    checkOutBtn?.addEventListener('click', () => addAttendanceEntry('Checked Out'));
    renderAttendance();
    window.setInterval(() => {
        if (!attendanceDuration) return;
        const latestEntry = loadAttendance().filter(entry => entry?.status && entry?.time).at(-1);
        attendanceDuration.textContent = latestEntry?.status === 'Checked In' ? formatElapsedDuration(latestEntry.time) : '00:00:00';
    }, 1000);

    const profileForm = document.querySelector('[data-profile-form]');
    if (profileForm) {
        const nameField = profileForm.elements.namedItem('name');
        const emailField = profileForm.elements.namedItem('email');
        if (nameField) nameField.value = user?.name || '';
        if (emailField) emailField.value = user?.email || '';
    }
    profileForm?.addEventListener('submit', event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(profileForm).entries());
        const users = readStorage('usersDB', []);
        const index = users.findIndex(item => item.id === user?.id || item.email === user?.email);
        if (index < 0) return;
        users[index] = { ...users[index], name: values.name || users[index].name, email: values.email || users[index].email, password: values.password || users[index].password };
        localStorage.setItem('usersDB', JSON.stringify(users));
        localStorage.setItem('loggedInUser', JSON.stringify(users[index]));
        document.querySelectorAll('.user-profile span').forEach(name => { name.textContent = users[index].name || 'Student'; });
        addAdminNotification(`Profile updated by ${users[index].name}.`, users[index].email);
        alert('Profile updated successfully.');
    });
});

function initializeProfileNavigation(destination) {
    document.querySelectorAll('.user-profile').forEach(profile => {
        profile.setAttribute('role', 'link');
        profile.setAttribute('tabindex', '0');
        profile.setAttribute('aria-label', 'Edit profile');
        profile.title = 'Edit profile';
        const navigate = () => { window.location.href = destination; };
        profile.addEventListener('click', navigate);
        profile.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate();
            }
        });
    });
}

function initializeStudentFeatures(user) {
    if (!user?.email) return;
    const studentKey = `lms-student-notifications-${user.id || user.email}`;
    const readList = key => {
        const value = readStorage(key, []);
        return Array.isArray(value) ? value : [];
    };
    const pushStudentNotice = (title, message) => {
        const notices = readList(studentKey);
        notices.unshift({ title, message, read: false, created: new Date().toISOString() });
        localStorage.setItem(studentKey, JSON.stringify(notices.slice(0, 50)));
        window.dispatchEvent(new Event('lms-student-notifications-updated'));
    };
    const assignedCourses = () => readList('lms-courses').filter(course => course.status === 'Published' && (course.assignedStudentEmails || []).includes(user.email));
    const currentEnrollments = () => readList('lms-enrollments').filter(item => item.email === user.email);

    const renderEnrollments = () => {
        const container = document.getElementById('studentEnrollmentList');
        if (!container) return;
        const courses = assignedCourses();
        const enrollments = currentEnrollments();
        container.replaceChildren();
        if (!courses.length) {
            container.innerHTML = '<p class="student-catalog-empty">No courses have been assigned to your account yet.</p>';
            return;
        }
        courses.forEach(course => {
            const enrollment = enrollments.find(item => item.courseId === course.id) || null;
            const card = document.createElement('article');
            card.className = 'student-enrollment-card';
            card.innerHTML = `<img src="${escapeHTML(course.image || '../assets/image/images (2).jfif')}" alt="${escapeHTML(course.title)} cover"><div class="student-enrollment-details"><span class="cat">${escapeHTML(course.category || 'General')}</span><h3>${escapeHTML(course.title)}</h3><p>Price: ${Number(course.price || 0) === 0 ? 'Free' : `$${Number(course.price).toFixed(2)}`}</p><p>Payment: <strong>${escapeHTML(enrollment?.status || 'Pending')}</strong></p>${enrollment?.status === 'Pending' ? `<button class="btn-resume" type="button" data-enrollment-paid="${escapeHTML(enrollment.id)}">Confirm payment (demo)</button>` : ''}</div>`;
            container.appendChild(card);
        });
        const dashboardCourses = document.getElementById('dashboardCourseProgress');
        if (dashboardCourses) dashboardCourses.innerHTML = courses.length ? courses.slice(0, 3).map(course => {
            const payment = enrollments.find(item => item.courseId === course.id)?.status || 'Pending';
            return `<article class="p-card"><img src="${escapeHTML(course.image || '../assets/image/images (2).jfif')}" alt="${escapeHTML(course.title)} cover"><div class="p-details"><span class="cat">${escapeHTML(course.category || 'GENERAL')}</span><h3>${escapeHTML(course.title)}</h3><div class="progress-label"><span>Payment status</span><strong>${escapeHTML(payment)}</strong></div><div class="p-meta"><span>${Number(course.price || 0) === 0 ? 'Free course' : `$${Number(course.price).toFixed(2)}`}</span><a href="courses.html" class="btn-resume">Open course</a></div></div></article>`;
        }).join('') : '<p class="student-record-empty">Your assigned courses will appear here.</p>';
    };

    const processStudentSchedules = () => {
        [
            ['lms-admin-announcements', 'publishAt', 'announcement'],
            ['lms-admin-live-classes', 'schedule', 'live class']
        ].forEach(([key, timeKey, label]) => {
            const records = readList(key);
            let changed = false;
            records.forEach(record => {
                const release = new Date(record[timeKey]).getTime();
                if (!Number.isFinite(release) || release > Date.now()) return;
                if (record.status === 'Scheduled') { record.status = 'Published'; changed = true; }
                record.notifiedTo = Array.isArray(record.notifiedTo) ? record.notifiedTo : [];
                if (record.status === 'Published' && !record.notifiedTo.includes(user.email)) {
                    pushStudentNotice(label === 'announcement' ? record.title : 'Live class starting', label === 'announcement' ? record.message : `${record.title} is starting now.`);
                    record.notifiedTo.push(user.email);
                    changed = true;
                }
            });
            if (changed) localStorage.setItem(key, JSON.stringify(records));
        });
    };

    const renderAnnouncements = () => {
        const target = document.getElementById('studentAnnouncements');
        if (!target) return;
        const notices = readList('lms-admin-announcements').filter(item => item.status === 'Published' && (!item.audience || item.audience === 'All users' || item.audience === 'Students'));
        target.innerHTML = notices.length ? notices.slice().reverse().map(item => `<article class="student-record"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.message)}</p><time>${escapeHTML(new Date(item.publishAt || item.created).toLocaleString())}</time></article>`).join('') : '<p class="student-record-empty">No announcements yet.</p>';
    };

    const renderLiveClasses = () => {
        const target = document.getElementById('studentLiveClasses');
        if (!target) return;
        const classes = readList('lms-admin-live-classes').filter(item => ['Scheduled', 'Published'].includes(item.status) && new Date(item.schedule).getTime() >= Date.now() - 60 * 60 * 1000).sort((a, b) => new Date(a.schedule) - new Date(b.schedule));
        target.innerHTML = classes.length ? classes.map(item => {
            const canJoin = new Date(item.schedule).getTime() <= Date.now() && /^https?:\/\//i.test(item.joinUrl || '');
            return `<article class="student-record"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.course || 'Live session')} · ${escapeHTML(new Date(item.schedule).toLocaleString())}</p>${canJoin ? `<a class="btn-resume" href="${escapeHTML(item.joinUrl)}" target="_blank" rel="noopener noreferrer">Join class</a>` : '<span class="status-pill status-pending">Starts at scheduled time</span>'}</article>`;
        }).join('') : '<p class="student-record-empty">No live classes scheduled.</p>';
    };

    const renderAssignments = () => {
        const target = document.getElementById('studentAssignments');
        const select = document.querySelector('#assignmentSubmissionForm select[name="assignmentId"]');
        const assignments = readList('lms-admin-assignments').filter(item => item.studentEmail === user.email);
        if (target) target.innerHTML = assignments.length ? assignments.map(item => `<article class="student-record"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.course)} · Due ${escapeHTML(item.due || 'No due date')}</p><span class="status-pill ${item.status === 'Completed' ? 'status-active' : item.status === 'In Progress' || item.status === 'Submitted' ? 'status-pending' : 'status-inactive'}">${escapeHTML(item.status)}</span>${item.attachmentData ? `<img class="student-assignment-image" src="${escapeHTML(item.attachmentData)}" alt="Assignment reference">` : ''}${item.status === 'Pending' ? `<button type="button" class="module-row-action" data-start-assignment="${escapeHTML(item.id)}">Start assignment</button>` : ''}</article>`).join('') : '<p class="student-record-empty">No assignments assigned.</p>';
        if (select) {
            select.innerHTML = `<option value="">Choose an assignment</option>${assignments.filter(item => !['Completed', 'Submitted'].includes(item.status)).map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)}</option>`).join('')}`;
        }
    };

    const renderReviews = () => {
        const target = document.getElementById('studentReviews');
        const courseSelect = document.querySelector('#studentReviewForm select[name="course"]');
        const reviews = readList('lms-reviews').filter(item => item.email === user.email);
        if (target) target.innerHTML = reviews.length ? reviews.slice().reverse().map(item => `<article class="student-record"><strong>${escapeHTML(item.course)} · ${escapeHTML(item.rating)}/5</strong><p>${escapeHTML(item.comment)}</p><span class="status-pill ${item.status === 'Resolved' ? 'status-active' : 'status-pending'}">${escapeHTML(item.status || 'New')}</span></article>`).join('') : '<p class="student-record-empty">You have not submitted a review.</p>';
        if (courseSelect) courseSelect.innerHTML = `<option value="">Choose a course</option>${assignedCourses().map(course => `<option value="${escapeHTML(course.title)}">${escapeHTML(course.title)}</option>`).join('')}`;
    };

    const renderCertificates = () => {
        const target = document.getElementById('studentCertificates');
        if (!target) return;
        const certificates = readList('lms-admin-certificates').filter(item => item.studentEmail === user.email && item.status === 'Issued');
        target.innerHTML = certificates.length ? certificates.map(item => `<article class="student-certificate"><p class="eyebrow">TECH LMS · CERTIFICATE OF COMPLETION</p><i class="fa-solid fa-award" aria-hidden="true"></i><h3>${escapeHTML(item.course)}</h3><p>Presented to <strong>${escapeHTML(user.name || 'Student')}</strong></p><p>Issued ${escapeHTML(item.issued)} · ${escapeHTML(item.reference)}</p><button class="btn-resume" type="button" onclick="window.print()">Print certificate</button></article>`).join('') : '<p class="student-catalog-empty">No certificates have been issued to your account.</p>';
    };

    const renderCoupons = () => {
        const target = document.getElementById('studentCoupons');
        if (!target) return;
        const coupons = readList('lms-admin-coupons').filter(item => item.status === 'Active' && (!item.expires || new Date(`${item.expires}T23:59:59`) >= new Date()) && (item.audience !== 'One student' || item.studentEmail === user.email) && !(item.usedBy || []).includes(user.email) && Number(item.uses || 0) < Number(item.limit || Infinity));
        const canRedeem = currentEnrollments().some(item => item.status === 'Pending');
        target.innerHTML = coupons.length ? coupons.map(item => `<article class="student-record"><strong>${escapeHTML(item.code)} · ${escapeHTML(item.discount)}</strong><p>Expires ${escapeHTML(item.expires || 'No expiry')}</p>${canRedeem ? `<button type="button" class="btn-resume" data-apply-coupon="${escapeHTML(item.id)}">Apply to pending course</button>` : '<span class="status-pill status-pending">No pending course payment</span>'}</article>`).join('') : '<p class="student-record-empty">No coupons are available right now.</p>';
    };

    const renderAnalytics = () => {
        const chart = document.getElementById('weeklyStudyHoursChart');
        if (!chart) return;
        const attendanceKey = `studentAttendanceLog-${encodeURIComponent(String(user.id || user.email))}`;
        const attendance = readList(attendanceKey).filter(item => item?.status && item?.time).sort((a, b) => new Date(a.time) - new Date(b.time));
        const dailyMinutes = new Map();
        let checkIn = null;
        attendance.forEach(entry => {
            const entryTime = new Date(entry.time);
            if (entry.status === 'Checked In') checkIn = entryTime;
            if (entry.status === 'Checked Out' && checkIn) {
                const date = checkIn.toDateString();
                dailyMinutes.set(date, (dailyMinutes.get(date) || 0) + Math.max(0, (entryTime - checkIn) / 60000));
                checkIn = null;
            }
        });
        if (checkIn) {
            const date = checkIn.toDateString();
            dailyMinutes.set(date, (dailyMinutes.get(date) || 0) + Math.max(0, (Date.now() - checkIn) / 60000));
        }
        const dates = Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - 6 + index);
            return date;
        });
        const hours = dates.map(date => (dailyMinutes.get(date.toDateString()) || 0) / 60);
        const peak = Math.max(...hours, 1);
        chart.innerHTML = dates.map((date, index) => `<div class="study-hour-column" title="${hours[index].toFixed(1)} study hours"><div class="study-hour-track"><span style="height:${Math.max(hours[index] ? 6 : 0, hours[index] / peak * 100)}%"></span></div><span>${date.toLocaleDateString(undefined, { weekday: 'short' })}</span><small>${hours[index].toFixed(1)}h</small></div>`).join('');
        const totalHours = [...dailyMinutes.values()].reduce((sum, minutes) => sum + minutes, 0) / 60;
        const studyTime = document.getElementById('analyticsStudyTime');
        if (studyTime) studyTime.textContent = `${totalHours.toFixed(1)} Hrs`;
        const homeStudyTime = document.querySelector('.metric-time strong');
        if (homeStudyTime?.firstChild) homeStudyTime.firstChild.textContent = totalHours.toFixed(1);
        const activeDates = new Set(attendance.filter(entry => entry.status === 'Checked In').map(entry => new Date(entry.time).toDateString()));
        let streak = 0;
        const cursor = new Date();
        if (!activeDates.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
        while (activeDates.has(cursor.toDateString())) { streak++; cursor.setDate(cursor.getDate() - 1); }
        const streakNode = document.getElementById('analyticsStreak');
        if (streakNode) streakNode.textContent = `${streak} Days`;
        const myReviews = readList('lms-reviews').filter(item => item.email === user.email);
        const score = myReviews.length ? Math.round(myReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / myReviews.length * 20) : 0;
        const scoreNode = document.getElementById('analyticsAverageScore');
        if (scoreNode) scoreNode.textContent = `${score}%`;
    };

    const renderAll = () => {
        processStudentSchedules();
        renderEnrollments();
        const dashboardCourses = document.getElementById('dashboardCourseProgress');
        if (dashboardCourses) {
            const courses = assignedCourses();
            const enrollments = currentEnrollments();
            dashboardCourses.innerHTML = courses.length ? courses.slice(0, 3).map(course => {
                const payment = enrollments.find(item => item.courseId === course.id)?.status || 'Pending';
                return `<article class="p-card"><img src="${escapeHTML(course.image || '../assets/image/images (2).jfif')}" alt="${escapeHTML(course.title)} cover"><div class="p-details"><span class="cat">${escapeHTML(course.category || 'GENERAL')}</span><h3>${escapeHTML(course.title)}</h3><div class="progress-label"><span>Payment status</span><strong>${escapeHTML(payment)}</strong></div><div class="p-meta"><span>${Number(course.price || 0) === 0 ? 'Free course' : `$${Number(course.price).toFixed(2)}`}</span><a href="courses.html" class="btn-resume">Open course</a></div></div></article>`;
            }).join('') : '<p class="student-record-empty">Your assigned courses will appear here.</p>';
        }
        renderAnnouncements();
        renderLiveClasses();
        renderAssignments();
        renderReviews();
        renderCertificates();
        renderCoupons();
        renderAnalytics();
        const metrics = document.querySelectorAll('.student-metrics .metric-card strong');
        if (metrics.length) {
            metrics[0].textContent = String(assignedCourses().length);
            metrics[1].textContent = String(readList('lms-admin-assignments').filter(item => item.studentEmail === user.email && item.status === 'Completed').length);
            metrics[3].textContent = String(readList('lms-admin-certificates').filter(item => item.studentEmail === user.email && item.status === 'Issued').length);
        }
    };
    renderAll();

    document.getElementById('studentEnrollmentList')?.addEventListener('click', event => {
        const button = event.target.closest('[data-enrollment-paid]');
        if (!button) return;
        const enrollments = readList('lms-enrollments');
        const enrollment = enrollments.find(item => item.id === button.dataset.enrollmentPaid && item.email === user.email);
        if (!enrollment) return;
        enrollment.status = 'Paid';
        enrollment.paidAt = new Date().toISOString();
        localStorage.setItem('lms-enrollments', JSON.stringify(enrollments));
        addAdminNotification(`${user.name || 'A student'} marked a course payment paid.`, `${user.email}: ${enrollment.course}`);
        renderAll();
    });
    document.getElementById('studentCoupons')?.addEventListener('click', event => {
        const button = event.target.closest('[data-apply-coupon]');
        if (!button) return;
        const coupons = readList('lms-admin-coupons');
        const coupon = coupons.find(item => item.id === button.dataset.applyCoupon);
        if (!coupon || (coupon.audience === 'One student' && coupon.studentEmail !== user.email) || (coupon.usedBy || []).includes(user.email)) return;
        const enrollments = readList('lms-enrollments');
        const eligible = enrollments.filter(item => item.email === user.email && item.status === 'Pending' && !item.discountCode);
        if (!eligible.length) return;
        const discount = Math.min(100, Math.max(0, Number.parseFloat(coupon.discount) || 0));
        eligible.forEach(item => {
            item.originalAmount = Number(item.amount || 0);
            item.amount = Number((item.originalAmount * (1 - discount / 100)).toFixed(2));
            item.discountCode = coupon.code;
            if (item.amount === 0) item.status = 'Free';
        });
        coupon.usedBy = Array.isArray(coupon.usedBy) ? coupon.usedBy : [];
        coupon.usedBy.push(user.email);
        coupon.uses = Number(coupon.uses || 0) + 1;
        localStorage.setItem('lms-enrollments', JSON.stringify(enrollments));
        localStorage.setItem('lms-admin-coupons', JSON.stringify(coupons));
        addAdminNotification(`${user.name || 'A student'} redeemed a coupon.`, `${coupon.code} on ${eligible.length} pending enrollment(s).`);
        renderAll();
    });
    document.getElementById('studentAssignments')?.addEventListener('click', event => {
        const button = event.target.closest('[data-start-assignment]');
        if (!button) return;
        const assignments = readList('lms-admin-assignments');
        const assignment = assignments.find(item => item.id === button.dataset.startAssignment && item.studentEmail === user.email);
        if (!assignment) return;
        assignment.status = 'In Progress';
        localStorage.setItem('lms-admin-assignments', JSON.stringify(assignments));
        addAdminNotification(`${user.name || 'A student'} started an assignment.`, assignment.title);
        renderAll();
    });
    document.getElementById('assignmentSubmissionForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const file = form.elements.namedItem('submissionFile').files?.[0];
        const assignments = readList('lms-admin-assignments');
        const assignment = assignments.find(item => item.id === form.elements.namedItem('assignmentId').value && item.studentEmail === user.email);
        const status = document.getElementById('assignmentSubmissionStatus');
        if (!assignment || !file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
            if (status) status.textContent = 'Choose an assignment and a JPG, PNG, or WebP image under 1 MB.';
            return;
        }
        const image = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
        if (!image) { if (status) status.textContent = 'Could not read the image.'; return; }
        assignment.submissionData = image;
        assignment.submissionName = file.name;
        assignment.submittedAt = new Date().toISOString();
        assignment.status = 'Submitted';
        localStorage.setItem('lms-admin-assignments', JSON.stringify(assignments));
        addAdminNotification(`${user.name || 'A student'} submitted an assignment.`, `${assignment.title}: ${file.name}`);
        form.reset();
        if (status) status.textContent = 'Assignment submitted.';
        renderAll();
    });
    document.getElementById('studentReviewForm')?.addEventListener('submit', event => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form).entries());
        const reviews = readList('lms-reviews');
        reviews.push({ id: `review-${Date.now()}`, email: user.email, student: user.name || 'Student', course: values.course, rating: Number(values.rating), comment: values.comment.trim(), status: 'New', created: new Date().toISOString() });
        localStorage.setItem('lms-reviews', JSON.stringify(reviews));
        addAdminNotification('New student course review received.', `${user.name || 'Student'} · ${values.course} · ${values.rating}/5`);
        form.reset();
        const status = document.getElementById('studentReviewStatus');
        if (status) status.textContent = 'Review sent to the admin team.';
        renderAll();
    });
    window.addEventListener('storage', event => {
        if (['lms-courses', 'lms-enrollments', 'lms-admin-announcements', 'lms-admin-live-classes', 'lms-admin-assignments', 'lms-admin-certificates', 'lms-admin-coupons', 'lms-reviews'].includes(event.key) || event.key?.startsWith('studentAttendanceLog-')) renderAll();
    });
    window.setInterval(renderAll, 30000);
}

function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function addAdminNotification(text, detail) {
    const notifications = readStorage('lms-notifications', []);
    notifications.unshift({ text, detail, read: false, created: new Date().toISOString() });
    localStorage.setItem('lms-notifications', JSON.stringify(notifications.slice(0, 50)));
}

function initializeSession(requiredRole) {
    const user = readStorage('loggedInUser', null);
    const users = readStorage('usersDB', []);
    const currentUser = Array.isArray(users) ? users.find(item => item.email === user?.email && item.role === requiredRole) : null;
    const isInactive = !currentUser || currentUser.status === 'inactive' || currentUser.isActive === false;
    if (!user || user.role !== requiredRole || isInactive) {
        localStorage.removeItem('loggedInUser');
        window.location.href = '../signin.html';
        return false;
    }
    window.addEventListener('storage', event => {
        if (event.key !== 'usersDB') return;
        const updatedUsers = readStorage('usersDB', []);
        const updatedUser = Array.isArray(updatedUsers) ? updatedUsers.find(item => item.email === user.email && item.role === requiredRole) : null;
        if (!updatedUser || updatedUser.status === 'inactive' || updatedUser.isActive === false) {
            localStorage.removeItem('loggedInUser');
            window.location.href = '../signin.html';
        }
    });
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    const activeUser = readStorage('loggedInUser', null);
    if (!activeUser || activeUser.role !== 'student') return;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    const levelForm = document.getElementById('learningLevelForm');
    const levelField = document.getElementById('learningLevel');
    const levelStatus = document.getElementById('learningLevelStatus');
    if (levelField) {
        const users = readStorage('usersDB', []);
        const current = users.find(u => u.email === activeUser.email && u.role === 'student');
        levelField.value = current?.learningLevel || activeUser.learningLevel || 'Beginner';
    }
    levelForm?.addEventListener('submit', e => {
        e.preventDefault();
        const users = readStorage('usersDB', []);
        const i = users.findIndex(u => u.email === activeUser.email && u.role === 'student');
        if (i < 0) return;
        users[i].learningLevel = levelField.value;
        localStorage.setItem('usersDB', JSON.stringify(users));
        localStorage.setItem('loggedInUser', JSON.stringify(users[i]));
        if (levelStatus) levelStatus.textContent = 'Learning level saved successfully.';
        const notes = readStorage('lms-notifications', []);
        notes.unshift({text:'New Learning Level Update',detail:`${users[i].name || 'Student'} (${users[i].email}) selected ${levelField.value}.`,read:false,created:new Date().toISOString(),type:'learning-level'});
        localStorage.setItem('lms-notifications', JSON.stringify(notes.slice(0,50)));
    });

    const form = document.getElementById('leaveRequestForm');
    const list = document.getElementById('studentLeaveRequests');
    const status = document.getElementById('leaveRequestStatus');
    const renderLeaves = () => {
        if (!list) return;
        const all = readStorage('lms-leaves', []);
        const mine = (Array.isArray(all) ? all : []).filter(x => x.studentEmail === activeUser.email).slice().reverse();
        list.innerHTML = mine.length ? mine.map(x => `<article class="record-card"><div><strong>${esc(x.reason)}</strong><p>${esc(x.startDate)} to ${esc(x.endDate)}</p><p>${esc(x.description)}</p></div><span class="status-pill ${x.status==='Approved'?'status-active':x.status==='Rejected'?'status-inactive':'status-pending'}">${esc(x.status)}</span></article>`).join('') : '<div class="module-empty">No leave requests submitted yet.</div>';
    };
    renderLeaves();
    form?.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(form), startDate = fd.get('startDate'), endDate = fd.get('endDate');
        if (endDate < startDate) { if (status) status.textContent = 'End date cannot be before start date.'; return; }
        const leaves = readStorage('lms-leaves', []);
        leaves.push({id:`leave-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,studentId:activeUser.id || activeUser.email,studentEmail:activeUser.email,studentName:activeUser.name || 'Student',startDate,endDate,reason:fd.get('reason'),description:fd.get('description'),status:'Pending',created:new Date().toISOString(),reviewedAt:null});
        localStorage.setItem('lms-leaves', JSON.stringify(leaves));
        const notes = readStorage('lms-notifications', []);
        notes.unshift({text:'New Leave Request',detail:`${activeUser.name || 'Student'} (${activeUser.email}) requested ${startDate} to ${endDate}.`,read:false,created:new Date().toISOString(),type:'leave-request'});
        localStorage.setItem('lms-notifications', JSON.stringify(notes.slice(0,50)));
        form.reset(); if (status) status.textContent = 'Leave request submitted successfully.'; renderLeaves();
    });
    window.addEventListener('storage', e => { if (e.key === 'lms-leaves') renderLeaves(); });
});
