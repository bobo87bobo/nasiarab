function changeView(viewName) {
    appState.currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');

    document.querySelectorAll('#main-nav button.nav-item').forEach(b => {
        if (b.dataset.view === viewName) {
            b.classList.remove('tab-inactive');
            b.classList.add('tab-active');
        } else {
            b.classList.remove('tab-active');
            b.classList.add('tab-inactive');
        }
    });

    switch (viewName) {
        case 'dashboard':
            updateDashboard();
            setTimeout(initializeDashboardMap, 0);
            break;
        case 'sales': renderSalesTable(); break;
        case 'vendors': renderVendorList(); break;
        case 'products': renderProductList(); break;
        case 'invoicing':
            populateInvoiceVendorSelect();
            document.getElementById('invoice-display-area').classList.add('hidden');
            break;
    }
}

function initializeDashboardMap() {
    if (appMap) {
        appMap.invalidateSize();
        appMap.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                appMap.removeLayer(layer);
            }
        });
    } else {
        appMap = L.map('map-container').setView([2.9935, 101.7874], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(appMap);
    }

    vendorsData.forEach(vendor => {
        if (vendor.status !== 'System' && vendor.latitude && vendor.longitude) {
            try {
                const lat = parseFloat(vendor.latitude);
                const lon = parseFloat(vendor.longitude);
                if (!isNaN(lat) && !isNaN(lon)) {
                    L.marker([lat, lon]).addTo(appMap)
                        .bindPopup(`<b>${vendor.name}</b><br>${vendor.area || 'N/A'}`);
                }
            } catch (e) {
                console.error("Error parsing lat/lon for dashboard map vendor:", vendor.name, e);
            }
        }
    });
}

function initializeVendorModalMap(lat, lon) {
    const mapContainerId = 'vendor-modal-map-container';
    const mapContainer = document.getElementById(mapContainerId);
    if (!mapContainer) {
        console.error("Vendor modal map container not found!");
        return;
    }

    if (vendorModalMap) {
        vendorModalMap.remove();
        vendorModalMap = null;
        vendorMarker = null;
    }

    const initialLat = lat || 2.9935;
    const initialLon = lon || 101.7874;
    const initialZoom = (lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon))) ? 15 : 11;


    vendorModalMap = L.map(mapContainerId).setView([initialLat, initialLon], initialZoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(vendorModalMap);

    L.Control.geocoder({
        defaultMarkGeocode: false,
        placeholder: 'Search or click map...'
    }).on('markgeocode', function(e) {
        const latlng = e.geocode.center;
        vendorModalMap.setView(latlng, 15);
        updateVendorMarker(latlng);
        document.getElementById('vendorLatitude').value = latlng.lat.toFixed(6);
        document.getElementById('vendorLongitude').value = latlng.lng.toFixed(6);
    }).addTo(vendorModalMap);


    if (lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon))) {
        updateVendorMarker({lat: parseFloat(lat), lng: parseFloat(lon)});
    }

    vendorModalMap.on('click', function(e) {
        updateVendorMarker(e.latlng);
        document.getElementById('vendorLatitude').value = e.latlng.lat.toFixed(6);
        document.getElementById('vendorLongitude').value = e.latlng.lng.toFixed(6);
    });
    setTimeout(() => {
        if (vendorModalMap) {
            vendorModalMap.invalidateSize();
        }
    }, 200);
}

function updateVendorMarker(latlng) {
    if (vendorMarker) {
        vendorMarker.setLatLng(latlng);
    } else {
        vendorMarker = L.marker(latlng).addTo(vendorModalMap);
    }
}


function populateFilters() {
    const vendorFilter = document.getElementById('sales-vendor-filter');
    const platformFilter = document.getElementById('sales-platform-filter');
    // inventoryVendorFilter removed

    vendorFilter.innerHTML = '<option value="">All Vendors (for Vendor Sales)</option>';
    vendorsData.forEach(v => {
        if (v.status !== 'System') {
            const optionHTML = `<option value="${v.id}">${v.name}</option>`;
            vendorFilter.innerHTML += optionHTML;
        }
    });
     if (vendorsData.filter(v => v.status !== 'System').length === 0) {
        vendorFilter.innerHTML = '<option value="">No Vendors Added</option>';
    }


    platformFilter.innerHTML = '<option value="">All Platforms</option>';
    if (salesData && salesData.length > 0) {
        const platforms = [...new Set(salesData.map(s => s.salesPlatform))].sort();
        platforms.forEach(p => platformFilter.innerHTML += `<option value="${p}">${p}</option>`);
    } else {
        platformFilter.innerHTML = '<option value="">No Platforms Yet</option>';
    }
}

function getFilteredDashboardData() {
    const period = document.getElementById('dashboard-period').value;
    const now = new Date();
    let startDate;

    switch(period) {
        case 'today':
            startDate = getStartOfToday();
            break;
        case 'this_week':
            startDate = getStartOfWeek(now);
            break;
        case 'this_month':
            startDate = getStartOfMonth(now);
            break;
        case 'all_time':
        default:
            return salesData;
    }

    return salesData.filter(s => new Date(s.date) >= startDate);
}

function updateDashboard() {
    const data = getFilteredDashboardData();

    const totalRevenue = data.reduce((sum, s) => sum + (s.quantity * s.pricePerUnit), 0);
    const totalCommission = data.filter(s => s.saleSource === 'Vendor').reduce((sum, s) => sum + (s.quantity * s.commissionPerUnit), 0);
    const totalOrders = data.length;

    document.getElementById('metric-revenue').textContent = `RM ${totalRevenue.toFixed(2)}`;
    document.getElementById('metric-commission').textContent = `RM ${totalCommission.toFixed(2)}`;
    document.getElementById('metric-profit').textContent = `RM ${(totalRevenue - totalCommission).toFixed(2)}`;
    document.getElementById('metric-orders').textContent = totalOrders;

    renderDashboardCharts(data);
}

function renderDashboardCharts(data) {
    renderSalesTrendChart(data);
    renderBestSellersChart(data);
    renderTopVendorsChart(data.filter(s => s.saleSource === 'Vendor'));
    renderSalesPlatformChart(data);
}

function destroyChart(chartId) {
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
}

function renderSalesTrendChart(data) {
    destroyChart('salesTrendChart');
    const period = document.getElementById('dashboard-period').value;
    let trendData = {};

    if (period === 'this_month' || period === 'all_time') {
        trendData = data.reduce((acc, s) => {
            const weekStartDate = getStartOfWeek(new Date(s.date));
            const week = formatDate(weekStartDate, 'MMM d');
            if (!acc[week]) acc[week] = 0;
            acc[week] += s.quantity * s.pricePerUnit;
            return acc;
        }, {});
    } else {
        trendData = data.reduce((acc, s) => {
            const day = formatDate(new Date(s.date), 'E, MMM d');
            if (!acc[day]) acc[day] = 0;
            acc[day] += s.quantity * s.pricePerUnit;
            return acc;
        }, {});
    }

    const ctx = document.getElementById('salesTrendChart').getContext('2d');
    charts['salesTrendChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(trendData),
            datasets: [{
                label: 'Sales Revenue',
                data: Object.values(trendData),
                borderColor: '#ca8a04',
                backgroundColor: 'rgba(202, 138, 4, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderBestSellersChart(data) {
    destroyChart('bestSellersChart');
    const productSales = data.reduce((acc, s) => {
        const product = productsData.find(p => p.id === s.productId);
        const productName = product ? product.name : 'Unknown Product';
        if (!acc[productName]) acc[productName] = 0;
        acc[productName] += s.quantity;
        return acc;
    }, {});
    const ctx = document.getElementById('bestSellersChart').getContext('2d');
    charts['bestSellersChart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(productSales),
            datasets: [{
                data: Object.values(productSales),
                backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderTopVendorsChart(vendorSalesData) {
    destroyChart('topVendorsChart');
    const vendorSales = vendorSalesData.reduce((acc, s) => {
        const vendor = vendorsData.find(v => v.id === s.vendorId);
        const vendorName = vendor ? vendor.name : 'Unknown Vendor';
        if (!acc[vendorName]) acc[vendorName] = 0;
        acc[vendorName] += s.quantity * s.pricePerUnit;
        return acc;
    }, {});

    const sortedVendors = Object.entries(vendorSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const ctx = document.getElementById('topVendorsChart').getContext('2d');
    charts['topVendorsChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedVendors.map(v => v[0]),
            datasets: [{
                label: 'Sales by Vendor',
                data: sortedVendors.map(v => v[1]),
                backgroundColor: '#10b981'
            }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderSalesPlatformChart(data) {
    destroyChart('salesPlatformChart');
    const platformSales = data.reduce((acc, s) => {
        if (!acc[s.salesPlatform]) acc[s.salesPlatform] = 0;
        acc[s.salesPlatform] += s.quantity * s.pricePerUnit;
        return acc;
    }, {});

    const ctx = document.getElementById('salesPlatformChart').getContext('2d');
    charts['salesPlatformChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(platformSales),
            datasets: [{
                label: 'Sales by Platform',
                data: Object.values(platformSales),
                backgroundColor: '#3b82f6'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderSalesTable() {
    const searchTerm = document.getElementById('sales-search').value.toLowerCase();
    const sourceFilter = document.getElementById('sales-source-filter').value;
    const vendorFilter = document.getElementById('sales-vendor-filter').value;
    const platformFilter = document.getElementById('sales-platform-filter').value;
    const dateFilter = document.getElementById('sales-date-filter').value;

    const filteredData = salesData.filter(s => {
        const vendor = vendorsData.find(v => v.id === s.vendorId);
        const product = productsData.find(p => p.id === s.productId);

        const searchMatch = !searchTerm ||
                            (s.customerName && s.customerName.toLowerCase().includes(searchTerm)) ||
                            (s.notes && s.notes.toLowerCase().includes(searchTerm)) ||
                            (s.saleSource === 'Event' && s.eventNameLocation && s.eventNameLocation.toLowerCase().includes(searchTerm)) ||
                            (vendor && vendor.name.toLowerCase().includes(searchTerm)) ||
                            (product && product.name.toLowerCase().includes(searchTerm));

        const sourceMatch = !sourceFilter || s.saleSource === sourceFilter;
        let vendorMatchForTable = true;
        if (sourceFilter === 'Vendor') {
            vendorMatchForTable = !vendorFilter || s.vendorId == vendorFilter;
        } else if (vendorFilter && sourceFilter !== 'Vendor' && sourceFilter !== '') {
             vendorMatchForTable = false;
        }


        const platformMatch = !platformFilter || s.salesPlatform === platformFilter;
        const dateMatch = !dateFilter || isSameDateDay(new Date(s.date), new Date(dateFilter + "T00:00:00"));

        return searchMatch && sourceMatch && vendorMatchForTable && platformMatch && dateMatch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const tableBody = document.getElementById('sales-table-body');
    const emptyMsg = document.getElementById('sales-table-empty');
    if(filteredData.length === 0) {
        tableBody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');

    tableBody.innerHTML = filteredData.map(s => {
        const vendor = vendorsData.find(v => v.id === s.vendorId);
        const product = productsData.find(p => p.id === s.productId);
        const total = s.quantity * s.pricePerUnit;
        let vendorOrEventDisplay = vendor ? vendor.name : 'N/A';
        if (s.saleSource === 'Event') {
            vendorOrEventDisplay = s.eventNameLocation || 'Event';
             if (s.eventDate) vendorOrEventDisplay += ` (${formatDate(new Date(s.eventDate  + "T00:00:00"), 'MMM d, yyyy')})`;
        } else if (s.saleSource === 'Restaurant') {
            vendorOrEventDisplay = 'Restaurant';
        }


        return `
            <tr class="bg-white border-b hover:bg-slate-50">
                <td class="px-6 py-4">${formatDate(new Date(s.date), 'MMM d, yyyy')}</td>
                <td class="px-6 py-4">${s.saleSource}</td>
                <td class="px-6 py-4">${vendorOrEventDisplay}</td>
                <td class="px-6 py-4">${product ? product.name : 'Unknown'}</td>
                <td class="px-6 py-4">${s.quantity}</td>
                <td class="px-6 py-4 font-semibold">RM ${total.toFixed(2)}</td>
                <td class="px-6 py-4">${s.salesPlatform}</td>
                <td class="px-6 py-4">${s.customerName}</td>
                <td class="px-6 py-4">
                    <button onclick="showModal('editSale', ${s.id})" class="text-blue-600 hover:underline">Edit</button>
                    <button onclick="deleteItem('sale', ${s.id})" class="text-red-600 hover:underline ml-2">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderVendorList() {
    const listContainer = document.getElementById('vendor-list');
    const emptyMsg = document.getElementById('vendor-list-empty');
    const actualVendors = vendorsData.filter(v => v.status !== 'System');

    listContainer.innerHTML = '';

    if (actualVendors.length === 0) {
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');

    actualVendors.forEach(v => {
     listContainer.innerHTML += `
        <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-xl font-bold">${v.name}</h3>
                    <p class="text-sm text-slate-500">${v.area}</p>
                </div>
                <span class="text-xs font-semibold px-2 py-1 rounded-full ${v.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${v.status}</span>
            </div>
            <div class="mt-4 space-y-2 text-sm">
                <p><strong>Contact:</strong> ${v.contact || 'N/A'}</p>
                <p><strong>Commission:</strong> RM ${v.commissionRate.toFixed(2)} / unit</p>
                <p><strong>Closure Day:</strong> ${v.closureDay || 'N/A'}</p>
                <p><strong>Payment:</strong> ${v.paymentMethod || 'N/A'}</p>
                ${v.latitude && v.longitude ? `<p><strong>Location:</strong> ${parseFloat(v.latitude).toFixed(4)}, ${parseFloat(v.longitude).toFixed(4)}</p>` : '<p><strong>Location:</strong> Not Set</p>'}
            </div>
            <div class="mt-6 text-right">
                <button onclick="showModal('editVendor', ${v.id})" class="text-blue-600 hover:underline">Edit</button>
                <button onclick="deleteItem('vendor', ${v.id})" class="text-red-600 hover:underline ml-4">Delete</button>
            </div>
        </div>
    `;
    });
}

function renderProductList() {
    const listContainer = document.getElementById('product-list');
    const emptyMsg = document.getElementById('product-list-empty');
    listContainer.innerHTML = '';

    if (productsData.length === 0) {
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');

    productsData.forEach(p => {
        listContainer.innerHTML += `
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-xl font-bold">${p.name}</h3>
                <p class="text-lg text-yellow-700 font-semibold">RM ${p.price.toFixed(2)}</p>
                <div class="mt-4 text-right">
                     <button onclick="showModal('editProduct', ${p.id})" class="text-blue-600 hover:underline">Edit</button>
                     <button onclick="deleteItem('product', ${p.id})" class="text-red-600 hover:underline ml-4">Delete</button>
                </div>
            </div>
        `;
    });
}


// updateInventoryView removed

function showModal(type, id = null) {
    appState.editingId = id;
    appState.editingType = type;
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('modal-form');
    let currentData = {};
    let formHtml = '';

    let productOptions = productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    if (productsData.length === 0 && (type === 'addSale' || type === 'editSale')) {
        productOptions = '<option value="">No Products - Add via Products Tab</option>';
    }

    let vendorOptions = vendorsData.filter(v => v.status !== 'System').map(v => `<option value="${v.id}">${v.name}</option>`).join('');
     if (vendorsData.filter(v => v.status !== 'System').length === 0 && (type === 'addSale' || type === 'editSale')) {
        vendorOptions = '<option value="">No Vendors - Add via Vendors Tab</option>';
    }


    switch(type) {
        case 'addSale':
            modalTitle.textContent = 'Add New Sale';
            currentData = {
                date: new Date().toISOString().slice(0, 16),
                saleSource: 'Vendor',
                vendorId: vendorsData.find(v=>v.status !== 'System')?.id || '',
                productId: productsData[0]?.id || ''
            };
            formHtml = getSaleFormHtml(currentData);
            break;
        case 'editSale':
            modalTitle.textContent = 'Edit Sale';
            currentData = salesData.find(s => s.id === id);
            if (currentData) {
                currentData.date = new Date(currentData.date).toISOString().slice(0, 16);
            } else { currentData = { saleSource: 'Vendor' }; }
            formHtml = getSaleFormHtml(currentData);
            break;
        case 'addVendor':
            modalTitle.textContent = 'Add New Vendor';
            formHtml = getVendorFormHtml({});
            break;
        case 'editVendor':
            modalTitle.textContent = 'Edit Vendor';
            currentData = vendorsData.find(v => v.id === id) || {};
            formHtml = getVendorFormHtml(currentData);
            break;
        case 'addProduct':
            modalTitle.textContent = 'Add New Product';
            formHtml = getProductFormHtml({});
            break;
        case 'editProduct':
            modalTitle.textContent = 'Edit Product';
            currentData = productsData.find(p => p.id === id) || {};
            formHtml = getProductFormHtml(currentData);
            break;
        // Stock cases removed
    }

    form.innerHTML = formHtml;

    if (form.elements.saleSource && currentData.saleSource) form.elements.saleSource.value = currentData.saleSource;
    if (form.elements.vendorId && currentData.vendorId) form.elements.vendorId.value = currentData.vendorId;
    if (form.elements.productId && currentData.productId) form.elements.productId.value = currentData.productId;

    if (type === 'addSale' || type === 'editSale') {
        toggleSaleFormFields(form.elements.saleSource.value);
    }
    if (type === 'addVendor' || type === 'editVendor') {
        setTimeout(() => initializeVendorModalMap(currentData.latitude, currentData.longitude), 100);
    }


    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    setTimeout(() => modal.querySelector('.modal-content').classList.remove('scale-95'), 10);
}

function toggleSaleFormFields(source) {
    const vendorField = document.getElementById('saleVendorField');
    const eventFields = document.getElementById('eventSaleFields');

    if (vendorField) vendorField.classList.toggle('hidden', source !== 'Vendor');
    if (eventFields) eventFields.classList.toggle('hidden', source !== 'Event');
}


function getSaleFormHtml(data = {}) {
    const defaultVendorId = vendorsData.find(v => v.status !== 'System')?.id || '';
    const defaultProductId = productsData[0]?.id || '';

    const selectedVendorId = data.vendorId || defaultVendorId;
    const selectedProductId = data.productId || defaultProductId;

    const vendorOptionsHtml = vendorsData.filter(v => v.status !== 'System').map(v => `<option value="${v.id}" ${v.id == selectedVendorId ? 'selected' : ''}>${v.name}</option>`).join('');
    const productOptionsHtml = productsData.map(p => `<option value="${p.id}" ${p.id == selectedProductId ? 'selected' : ''}>${p.name}</option>`).join('');


    return `
        <input type="hidden" name="id" value="${data.id || ''}">
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-slate-700">Sale Source</label>
                <select name="saleSource" id="saleSourceSelector" class="w-full p-2 border rounded mt-1" required>
                    <option value="Vendor" ${data.saleSource === 'Vendor' ? 'selected' : ''}>Vendor Sale</option>
                    <option value="Restaurant" ${data.saleSource === 'Restaurant' ? 'selected' : ''}>Restaurant Sale</option>
                    <option value="Event" ${data.saleSource === 'Event' ? 'selected' : ''}>Event Sale</option>
                </select>
            </div>
            <div id="saleVendorField" class="${data.saleSource !== 'Vendor' ? 'hidden' : ''}">
                <label class="block text-sm font-medium text-slate-700">Vendor</label>
                <select name="vendorId" class="w-full p-2 border rounded mt-1" ${vendorOptionsHtml ? '' : 'disabled'}>
                    ${vendorOptionsHtml || '<option value="">Add Vendors First</option>'}
                </select>
            </div>
             <div id="eventSaleFields" class="space-y-4 ${data.saleSource !== 'Event' ? 'hidden' : ''}">
                <div><label class="block text-sm font-medium text-slate-700">Event Name/Location</label><input type="text" name="eventNameLocation" class="w-full p-2 border rounded mt-1" value="${data.eventNameLocation || ''}"></div>
                <div><label class="block text-sm font-medium text-slate-700">Event Date</label><input type="date" name="eventDate" class="w-full p-2 border rounded mt-1" value="${data.eventDate || ''}"></div>
                <div><label class="block text-sm font-medium text-slate-700">Event Time</label><input type="time" name="eventTime" class="w-full p-2 border rounded mt-1" value="${data.eventTime || ''}"></div>
            </div>

            <div><label class="block text-sm font-medium text-slate-700">Date & Time of Sale</label><input type="datetime-local" name="date" class="w-full p-2 border rounded mt-1" value="${data.date || new Date().toISOString().slice(0, 16)}" required></div>
            <div><label class="block text-sm font-medium text-slate-700">Product</label><select name="productId" class="w-full p-2 border rounded mt-1" required ${productOptionsHtml ? '' : 'disabled'}>${productOptionsHtml || '<option value="">Add Products First</option>'}</select></div>
            <div><label class="block text-sm font-medium text-slate-700">Quantity</label><input type="number" name="quantity" min="1" class="w-full p-2 border rounded mt-1" value="${data.quantity || 1}" required></div>
            <div><label class="block text-sm font-medium text-slate-700">Payment Method</label><input type="text" name="paymentMethod" class="w-full p-2 border rounded mt-1" value="${data.paymentMethod || 'Cash'}" required></div>
            <div><label class="block text-sm font-medium text-slate-700">Sales Platform</label><input type="text" name="salesPlatform" class="w-full p-2 border rounded mt-1" value="${data.salesPlatform || 'Walk-in'}" required></div>
            <div><label class="block text-sm font-medium text-slate-700">Customer Name</label><input type="text" name="customerName" class="w-full p-2 border rounded mt-1" value="${data.customerName || 'Anonymous'}"></div>
            <div><label class="block text-sm font-medium text-slate-700">Notes</label><textarea name="notes" class="w-full p-2 border rounded mt-1">${data.notes || ''}</textarea></div>
        </div>
        <div class="mt-6 text-right"><button type="submit" class="bg-yellow-600 text-white font-bold py-2 px-6 rounded-lg" ${productOptionsHtml && (data.saleSource !== 'Vendor' || vendorOptionsHtml) ? '' : 'disabled'}>Save Sale</button></div>
    `;
}

function getVendorFormHtml(data = {}) {
    return `
        <input type="hidden" name="id" value="${data.id || ''}">
        <div class="space-y-4">
            <div><label class="block text-sm font-medium text-slate-700">Name</label><input type="text" name="name" class="w-full p-2 border rounded mt-1" value="${data.name || ''}" required></div>
            <div><label class="block text-sm font-medium text-slate-700">Contact</label><input type="tel" name="contact" class="w-full p-2 border rounded mt-1" value="${data.contact || ''}"></div>
            <div><label class="block text-sm font-medium text-slate-700">Area</label><input type="text" name="area" class="w-full p-2 border rounded mt-1" value="${data.area || ''}"></div>
            <div><label class="block text-sm font-medium text-slate-700">Commission Rate (RM)</label><input type="number" step="0.01" name="commissionRate" class="w-full p-2 border rounded mt-1" value="${data.commissionRate !== undefined ? data.commissionRate.toFixed(2) : 1.00}"></div>
            <div><label class="block text-sm font-medium text-slate-700">Closure Day</label><input type="text" name="closureDay" class="w-full p-2 border rounded mt-1" value="${data.closureDay || 'None'}"></div>
            <div><label class="block text-sm font-medium text-slate-700">Payment Method</label><input type="text" name="paymentMethod" class="w-full p-2 border rounded mt-1" value="${data.paymentMethod || 'COD'}"></div>

            <div id="vendor-modal-map-container"></div>
            <div><label class="block text-sm font-medium text-slate-700">Latitude</label><input type="text" id="vendorLatitude" name="latitude" class="w-full p-2 border rounded mt-1" value="${data.latitude || ''}" placeholder="Populated by map"></div>
            <div><label class="block text-sm font-medium text-slate-700">Longitude</label><input type="text" id="vendorLongitude" name="longitude" class="w-full p-2 border rounded mt-1" value="${data.longitude || ''}" placeholder="Populated by map"></div>
            <p class="text-xs text-slate-500">Search or click map to set location. Coordinates will auto-fill.</p>

            <div><label class="block text-sm font-medium text-slate-700">Status</label><select name="status" class="w-full p-2 border rounded mt-1"><option value="Active" ${data.status === 'Active' ? 'selected' : ''}>Active</option><option value="Inactive" ${data.status === 'Inactive' ? 'selected' : ''}>Inactive</option></select></div>
        </div>
        <div class="mt-6 text-right"><button type="submit" class="bg-yellow-600 text-white font-bold py-2 px-6 rounded-lg">Save Vendor</button></div>
    `;
}
function getProductFormHtml(data = {}) {
    return `
        <input type="hidden" name="id" value="${data.id || ''}">
        <div class="space-y-4">
            <div><label class="block text-sm font-medium text-slate-700">Product Name</label><input type="text" name="name" class="w-full p-2 border rounded mt-1" value="${data.name || ''}" required></div>
            <div><label class="block text-sm font-medium text-slate-700">Price (RM)</label><input type="number" step="0.01" name="price" class="w-full p-2 border rounded mt-1" value="${data.price !== undefined ? data.price.toFixed(2) : ''}" required></div>
        </div>
        <div class="mt-6 text-right"><button type="submit" class="bg-yellow-600 text-white font-bold py-2 px-6 rounded-lg">Save Product</button></div>
    `;
}


// getInventoryFormHtml removed

function hideModal() {
    const modal = document.getElementById('modal');
    modal.classList.add('opacity-0');
    modal.querySelector('.modal-content').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 250);
    if (vendorModalMap) {
        vendorModalMap.remove();
        vendorModalMap = null;
        vendorMarker = null;
    }
}

function handleFormSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    switch (appState.editingType) {
        case 'addSale':
        case 'editSale':
            saveSale(data);
            break;
        case 'addVendor':
        case 'editVendor':
            saveVendor(data);
            break;
        case 'addProduct':
        case 'editProduct':
            saveProduct(data);
            break;
        // Stock cases removed
    }

    hideModal();
    changeView(appState.currentView);
    saveAllDataToLocalStorage();
}

// --- Invoicing Functions ---
function populateInvoiceVendorSelect() {
    const select = document.getElementById('invoice-vendor-select');
    select.innerHTML = '<option value="">Select a Vendor</option>';
    vendorsData.filter(v => v.status !== 'System').forEach(v => {
        select.innerHTML += `<option value="${v.id}">${v.name}</option>`;
    });
}

function toggleInvoiceDateRange(period) {
    const customRangeDiv = document.getElementById('invoice-custom-date-range');
    if (period === 'custom') {
        customRangeDiv.classList.remove('hidden');
    } else {
        customRangeDiv.classList.add('hidden');
    }
}

function generateInvoice() {
    const vendorId = document.getElementById('invoice-vendor-select').value;
    const periodType = document.getElementById('invoice-period-select').value;

    if (!vendorId) {
        alert("Please select a vendor.");
        return;
    }

    const selectedVendor = vendorsData.find(v => v.id == vendorId);
    if (!selectedVendor) {
        alert("Selected vendor not found.");
        return;
    }

    let startDate, endDate = new Date(); // endDate is today by default for most periods

    if (periodType === 'last7days') {
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
    } else if (periodType === 'last30days') {
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
    } else if (periodType === 'current_month') {
        startDate = getStartOfMonth(endDate);
    } else if (periodType === 'custom') {
        const startVal = document.getElementById('invoice-start-date').value;
        const endVal = document.getElementById('invoice-end-date').value;
        if (!startVal || !endVal) {
            alert("Please select a start and end date for the custom range.");
            return;
        }
        startDate = new Date(startVal + "T00:00:00"); // Ensure start of day
        endDate = new Date(endVal + "T23:59:59");   // Ensure end of day
    } else {
        alert("Invalid period selected.");
        return;
    }
    startDate.setHours(0,0,0,0); // Normalize start date

    const invoiceSales = salesData.filter(s =>
        s.vendorId == vendorId &&
        s.saleSource === 'Vendor' && // Only vendor sales for commission invoice
        new Date(s.date) >= startDate &&
        new Date(s.date) <= endDate
    );

    if (invoiceSales.length === 0) {
        alert(`No sales found for ${selectedVendor.name} in the selected period.`);
        document.getElementById('invoice-display-area').classList.add('hidden');
        return;
    }

    let totalGrossSales = 0;
    let totalCommission = 0;
    const invoiceItemsHtml = invoiceSales.map(sale => {
        const product = productsData.find(p => p.id === sale.productId);
        const itemTotal = sale.quantity * sale.pricePerUnit;
        const itemCommission = sale.quantity * sale.commissionPerUnit;
        totalGrossSales += itemTotal;
        totalCommission += itemCommission;
        return `
            <tr>
                <td>${formatDate(new Date(sale.date), 'MMM d, yyyy')}</td>
                <td>${product ? product.name : 'Unknown Product'}</td>
                <td class="text-right">${sale.quantity}</td>
                <td class="text-right">RM ${sale.pricePerUnit.toFixed(2)}</td>
                <td class="text-right">RM ${itemTotal.toFixed(2)}</td>
                <td class="text-right">RM ${sale.commissionPerUnit.toFixed(2)}</td>
                <td class="text-right">RM ${itemCommission.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const netPayable = totalGrossSales - totalCommission; // Example: if commission is paid out from gross. Adjust as needed.

    currentInvoiceData = {
        vendor: selectedVendor,
        periodStart: formatDate(startDate, 'MMM d, yyyy'),
        periodEnd: formatDate(endDate, 'MMM d, yyyy'),
        invoiceNumber: `INV-${Date.now()}`,
        invoiceDate: formatDate(new Date(), 'MMM d, yyyy'),
        items: invoiceSales, // Store raw items for potential other uses
        totalGrossSales,
        totalCommission,
        netPayable
    };


    const invoiceHtml = `
        <div style="font-family: Arial, sans-serif; margin: 20px; padding: 20px; border: 1px solid #ccc;">
            <h1 style="text-align: center; color: #333;">INVOICE</h1>
            <hr>
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                <div>
                    <h3 style="margin:0;">Chef Ammar Nasi Arab</h3>
                    <p style="margin:0;">Kajang, Selangor</p>
                    <p style="margin:0;">(Your Contact Info)</p>
                </div>
                <div style="text-align: right;">
                    <p><strong>Invoice #:</strong> ${currentInvoiceData.invoiceNumber}</p>
                    <p><strong>Date:</strong> ${currentInvoiceData.invoiceDate}</p>
                </div>
            </div>
            <div style="margin-bottom: 20px;">
                <h4 style="margin:0 0 5px 0;">Bill To:</h4>
                <p style="margin:0;"><strong>${selectedVendor.name}</strong></p>
                <p style="margin:0;">${selectedVendor.area || 'N/A'}</p>
                <p style="margin:0;">Contact: ${selectedVendor.contact || 'N/A'}</p>
            </div>
            <p><strong>Billing Period:</strong> ${currentInvoiceData.periodStart} - ${currentInvoiceData.periodEnd}</p>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Product</th>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Total Sales</th>
                        <th class="text-right">Comm./Unit</th>
                        <th class="text-right">Total Comm.</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoiceItemsHtml}
                </tbody>
            </table>
            <div style="margin-top: 20px; text-align: right;">
                <p><strong>Total Gross Sales:</strong> RM ${totalGrossSales.toFixed(2)}</p>
                <p><strong>Total Commission:</strong> RM ${totalCommission.toFixed(2)}</p>
                <hr style="margin: 5px 0;">
                <p style="font-size: 1.1em;"><strong>Net Amount Due:</strong> RM ${netPayable.toFixed(2)}</p>
            </div>
            <div style="margin-top: 30px; text-align: center; font-size: 0.8em; color: #777;">
                <p>Thank you for your business!</p>
            </div>
        </div>
    `;

    document.getElementById('invoice-preview-area').innerHTML = invoiceHtml;
    document.getElementById('invoice-display-area').classList.remove('hidden');
}

function downloadInvoicePDF() {
    if (!currentInvoiceData) {
        alert("Please generate an invoice first.");
        return;
    }
    const element = document.getElementById('invoice-preview-area');
    const opt = {
      margin:       0.5,
      filename:     `Invoice_${currentInvoiceData.vendor.name.replace(/\s+/g, '_')}_${currentInvoiceData.invoiceNumber}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

function prepareWhatsAppMessage() {
    if (!currentInvoiceData || !currentInvoiceData.vendor) {
        alert("Please generate an invoice first.");
        return;
    }
    const vendor = currentInvoiceData.vendor;
    let phoneNumber = vendor.contact ? vendor.contact.replace(/\D/g,'') : ''; // Remove non-digits

    // Basic Malaysian phone number formatting assumption
    if (phoneNumber.startsWith('01')) {
        phoneNumber = '6' + phoneNumber; // Add 6 if it starts with 01 (e.g., 012 -> 6012)
    } else if (!phoneNumber.startsWith('60')) {
        // If it doesn't start with 60, and not 01, it might be incomplete or already international.
        // This is a basic check; robust international formatting is complex.
    }


    if (!phoneNumber) {
        alert("Vendor contact number is not available or invalid.");
        return;
    }

    const message = encodeURIComponent(
        `Hi ${vendor.name},\n\nPlease find your invoice for the period ${currentInvoiceData.periodStart} - ${currentInvoiceData.periodEnd} attached.\n\nTotal Amount Due: RM ${currentInvoiceData.netPayable.toFixed(2)}\n\nThank you,\nChef Ammar Nasi Arab`
    );

    alert("Please ensure you have downloaded the PDF. After clicking OK, WhatsApp will open. You will need to manually attach the downloaded PDF to the chat.");

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
}

function populateInvoiceVendorSelect() {
    const select = document.getElementById('invoice-vendor-select');
    select.innerHTML = '<option value="">-- Select Vendor --</option>';
    vendorsData.filter(v => v.status !== 'System').forEach(v => { // Exclude system vendors
        select.innerHTML += `<option value="${v.id}">${v.name}</option>`;
    });
}
