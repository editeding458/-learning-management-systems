document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'course-editor-dialog';
    dialog.innerHTML = `
        <form class="course-editor-form" id="courseEditorForm">
            <header class="course-editor-heading">
                <div><p class="eyebrow">COURSE SETTINGS</p><h2>Edit course</h2></div>
                <button class="course-editor-close" type="button" aria-label="Close editor">&times;</button>
            </header>
            <label>Course title<input name="title" required maxlength="100"></label>
            <label>Category<input name="category" required maxlength="60"></label>
            <label>Assigned students<select name="assignedStudentEmails" multiple size="5"></select><small>Only selected students can view this course.</small></label>
            <label>Price (USD)<input name="price" type="number" min="0" step="0.01" required></label>
            <label>Visibility<select name="status"><option>Draft</option><option>Published</option></select></label>
            <label>Course sessions <textarea name="sessions" rows="7" placeholder="Session 1 | Introduction | https://example.com/video.mp4
Session 2 | HTML Basics | https://www.youtube.com/watch?v=VIDEO_ID"></textarea><small>One session per line: title | session name | video URL. YouTube, MP4 and other browser-playable video URLs are supported.</small></label>
            <label class="course-editor-image-field">Replace course image <input name="image" type="file" accept="image/jpeg,image/png,image/webp"><small>Leave empty to keep the current image. JPG, PNG, or WebP up to 1 MB.</small></label>
            <img class="course-editor-preview" alt="Current course image" hidden>
            <p class="course-editor-message" role="status" aria-live="polite"></p>
            <footer><button class="button button-outline" type="button" data-course-cancel>Cancel</button><button class="button button-primary" type="submit">Save changes</button></footer>
        </form>`;
    document.body.appendChild(dialog);

    const form = dialog.querySelector('#courseEditorForm');
    const studentsSelect = form.elements.namedItem('assignedStudentEmails');
    const imageInput = form.elements.namedItem('image');
    const preview = dialog.querySelector('.course-editor-preview');
    const message = dialog.querySelector('.course-editor-message');
    let editingCourseId = '';

    const readCourses = () => {
        const courses = courseReadStorage('lms-courses', []);
        return Array.isArray(courses) ? courses : [];
    };

    const fillAccounts = course => {
        const users = courseReadStorage('usersDB', []);
        const activeUsers = Array.isArray(users) ? users : [];
        studentsSelect.replaceChildren();
        activeUsers.filter(account => account.role === 'student' && account.status !== 'inactive' && account.isActive !== false).forEach(account => {
            studentsSelect.add(new Option(`${account.name || 'Student'} (${account.email})`, account.email));
        });
        [...studentsSelect.options].forEach(option => {
            option.selected = (course.assignedStudentEmails || []).includes(option.value);
        });
    };

    const openEditor = courseId => {
        const course = readCourses().find(item => String(item.id) === String(courseId));
        if (!course) return;
        editingCourseId = String(course.id);
        form.elements.namedItem('title').value = course.title || '';
        form.elements.namedItem('category').value = course.category || '';
        form.elements.namedItem('price').value = Number(String(course.price || '0').replace(/[^\d.]/g, '') || 0);
        form.elements.namedItem('status').value = course.status || 'Draft';
        form.elements.namedItem('sessions').value = Array.isArray(course.sessions)
            ? course.sessions.map((session, index) => `${session.title || `Session ${index + 1}`} | ${session.name || session.title || `Session ${index + 1}`} | ${session.videoUrl || ''}`).join('\n')
            : '';
        fillAccounts(course);
        imageInput.value = '';
        preview.src = course.image || '';
        preview.hidden = !course.image;
        message.textContent = '';
        dialog.showModal();
    };

    document.addEventListener('click', event => {
        const editButton = event.target.closest('[data-edit-course]');
        if (editButton) {
            openEditor(editButton.dataset.editCourse);
            return;
        }
        const deleteButton = event.target.closest('[data-delete-course]');
        if (!deleteButton) return;
        const courseId = deleteButton.dataset.deleteCourse;
        const course = readCourses().find(item => String(item.id) === String(courseId));
        if (!course) return;
        if (!window.confirm(`Delete "${course.title}"? This removes it from assigned students too.`)) return;
        const remaining = readCourses().filter(item => String(item.id) !== String(courseId));
        localStorage.setItem('lms-courses', JSON.stringify(remaining));
        const enrollments = courseReadStorage('lms-enrollments', []);
        if (Array.isArray(enrollments)) localStorage.setItem('lms-enrollments', JSON.stringify(enrollments.filter(item => String(item.courseId) !== String(courseId) && item.course !== course.title)));
        const adminCourses = courseReadStorage('lms-admin-add-course', []);
        if (Array.isArray(adminCourses)) localStorage.setItem('lms-admin-add-course', JSON.stringify(adminCourses.filter(item => String(item.id) !== String(courseId))));
        window.dispatchEvent(new Event('lms-courses-updated'));
        showCourseToast('Course deleted.');
    });

    imageInput.addEventListener('change', () => {
        const file = imageInput.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
            imageInput.value = '';
            message.textContent = 'Choose a JPG, PNG, or WebP image under 1 MB.';
            return;
        }
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
        message.textContent = '';
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const courses = readCourses();
        const courseIndex = courses.findIndex(item => String(item.id) === editingCourseId);
        if (courseIndex < 0) {
            message.textContent = 'This course is no longer available.';
            return;
        }
        const values = Object.fromEntries(new FormData(form).entries());
        const sessions = String(values.sessions || '').split(/\r?\n/).map((line, index) => {
            const parts = line.split('|').map(part => part.trim());
            if (!parts[0]) return null;
            return { id: `session-${Date.now()}-${index}`, title: parts[0], name: parts[1] || parts[0], videoUrl: parts[2] || '' };
        }).filter(Boolean);
        const selectedStudents = [...studentsSelect.selectedOptions].map(option => option.value);
        if (values.status === 'Published' && !selectedStudents.length) {
            message.textContent = 'Assign the published course to at least one student.';
            return;
        }

        let image = courses[courseIndex].image || '';
        const file = imageInput.files?.[0];
        if (file) {
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
                message.textContent = 'Choose a JPG, PNG, or WebP image under 1 MB.';
                return;
            }
            image = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
            if (!image) {
                message.textContent = 'Could not read this image. Choose it again.';
                return;
            }
        }

        const updatedCourse = { ...courses[courseIndex] };
        delete updatedCourse.instructorEmail;
        delete updatedCourse.instructorName;
        delete updatedCourse.instructor;
        courses[courseIndex] = {
            ...updatedCourse,
            title: values.title.trim(),
            category: values.category.trim(),
            assignedStudentEmails: selectedStudents,
            assignedStudentCount: selectedStudents.length,
            students: String(selectedStudents.length),
            price: Number(values.price).toFixed(2),
            status: values.status,
            sessions,
            image
        };

        try {
            localStorage.setItem('lms-courses', JSON.stringify(courses));
            const adminCourses = courseReadStorage('lms-admin-add-course', []);
            if (Array.isArray(adminCourses)) {
                const adminIndex = adminCourses.findIndex(item => String(item.id) === editingCourseId);
                if (adminIndex >= 0) adminCourses[adminIndex] = { ...adminCourses[adminIndex], ...courses[courseIndex] };
                localStorage.setItem('lms-admin-add-course', JSON.stringify(adminCourses));
            }
        } catch {
            message.textContent = 'Browser storage is full. Try a smaller image.';
            return;
        }
        const updated = courses[courseIndex];
        const users = courseReadStorage('usersDB', []);
        const enrollments = courseReadStorage('lms-enrollments', []);
        const safeEnrollments = Array.isArray(enrollments) ? enrollments : [];
        if (updated.status === 'Published') selectedStudents.forEach(email => {
            const student = users.find(account => account.role === 'student' && account.email === email);
            if (!student) return;
            if (!safeEnrollments.some(item => String(item.courseId) === String(updated.id) && item.email === email)) safeEnrollments.push({ id: `enrollment-${updated.id}-${student.id || email}`, student: student.name || 'Student', email, course: updated.title, courseId: updated.id, amount: Number(updated.price), status: Number(updated.price) === 0 ? 'Free' : 'Pending', created: new Date().toISOString() });
            const key = `lms-student-notifications-${student.id || student.email}`;
            const notices = courseReadStorage(key, []);
            notices.unshift({ title: 'Course updated', message: `${updated.title} is available in your courses.`, read: false, created: new Date().toISOString() });
            localStorage.setItem(key, JSON.stringify(notices.slice(0, 50)));
        });
        localStorage.setItem('lms-enrollments', JSON.stringify(safeEnrollments));
        window.dispatchEvent(new Event('lms-courses-updated'));
        dialog.close();
        showCourseToast('Course changes saved.');
    });

    const closeEditor = () => dialog.close();
    dialog.querySelector('.course-editor-close').addEventListener('click', closeEditor);
    dialog.querySelector('[data-course-cancel]').addEventListener('click', closeEditor);
    dialog.addEventListener('click', event => event.target === dialog && closeEditor());
});

function courseReadStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function showCourseToast(text) {
    document.querySelector('.course-action-toast')?.remove();
    const toast = document.createElement('p');
    toast.className = 'course-action-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = text;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2600);
}