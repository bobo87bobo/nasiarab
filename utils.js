// --- Native Date Helper Functions ---
function getStartOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
}

function getStartOfWeek(date, options = { weekStartsOn: 1 }) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day < options.weekStartsOn ? 7 : 0) + day - options.weekStartsOn;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getStartOfMonth(date) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatDate(date, formatStr) {
    const d = new Date(date);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    if (formatStr === 'MMM d, yyyy') {
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
    if (formatStr === 'E, MMM d') {
        return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
    }
    if (formatStr === 'MMM d') {
         return `${months[d.getMonth()]} ${d.getDate()}`;
    }
    if (formatStr === 'yyyy-MM-dd') {
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const dayOfMonth = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${dayOfMonth}`;
    }
    return d.toLocaleDateString();
}


function isSameDateDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}
