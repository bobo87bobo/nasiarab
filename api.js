// --- LocalStorage Functions ---
function saveAllDataToLocalStorage() {
    localStorage.setItem('nasiArabSalesData', JSON.stringify(salesData));
    localStorage.setItem('nasiArabVendorsData', JSON.stringify(vendorsData));
    localStorage.setItem('nasiArabProductsData', JSON.stringify(productsData));
    // inventoryData removed from saving
    console.log("Data saved to localStorage");
}

function loadDataFromLocalStorage() {
    const sales = localStorage.getItem('nasiArabSalesData');
    const vendors = localStorage.getItem('nasiArabVendorsData');
    const products = localStorage.getItem('nasiArabProductsData');
    // inventoryData removed from loading

    let loadedSuccessfully = true;

    if (sales) try { salesData = JSON.parse(sales); } catch (e) { console.error("Error parsing salesData:", e); loadedSuccessfully = false; salesData = []; }
    else { loadedSuccessfully = false; salesData = []; }

    if (vendors) try { vendorsData = JSON.parse(vendors); } catch (e) { console.error("Error parsing vendorsData:", e); loadedSuccessfully = false; vendorsData = []; }
    else { loadedSuccessfully = false; vendorsData = []; }

    if (products) try { productsData = JSON.parse(products); } catch (e) { console.error("Error parsing productsData:", e); loadedSuccessfully = false; productsData = []; }
    else { loadedSuccessfully = false; productsData = []; }

    // inventoryData removed
    if (loadedSuccessfully && sales && vendors && products) { // Check for products now
        console.log("All data loaded from localStorage");
        return true;
    }
    console.log("Some or all data not found/loaded from localStorage. Will initialize as empty or with defaults.");
    return false;
}


function generateAndEnsureDefaultData() {
    if (!Array.isArray(productsData)) productsData = [];
    if (!Array.isArray(vendorsData)) vendorsData = [];
    if (!Array.isArray(salesData)) salesData = [];
    // inventoryData removed

    if (vendorsData.length === 0 || !vendorsData.some(v => v.name === 'Restaurant Direct' && v.status === 'System')) {
         vendorsData.push(
            { id: Date.now() + 1000, name: 'Restaurant Direct', contact: 'N/A', area: 'Restaurant/Event', commissionRate: 0.00, closureDay: 'None', paymentMethod: 'Internal', status: 'System', latitude: null, longitude: null }
        );
    }
    console.log("Data arrays ensured/initialized.");
}

function saveSale(data) {
    const product = productsData.find(p => p.id == data.productId);
    let vendor;
    let commissionRate = 0;
    let actualVendorId;

    if (data.saleSource === 'Vendor') {
        vendor = vendorsData.find(v => v.id == data.vendorId);
        if (!vendor) { console.error("Vendor not found for Vendor Sale"); return; }
        commissionRate = vendor.commissionRate;
        actualVendorId = vendor.id;
    } else {
        vendor = vendorsData.find(v => v.name === 'Restaurant Direct' && v.status === 'System');
        if (!vendor) {
            vendor = { id: Date.now() + 2000, name: 'Restaurant Direct', commissionRate: 0, status: 'System', latitude: null, longitude: null };
            vendorsData.push(vendor);
        }
        actualVendorId = vendor.id;
    }

    if (!product) { console.error("Product not found for Sale"); return; }


    const saleObject = {
        id: data.id ? parseInt(data.id) : Date.now(),
        date: new Date(data.date).toISOString(),
        saleSource: data.saleSource,
        vendorId: actualVendorId,
        productId: parseInt(data.productId),
        quantity: parseInt(data.quantity),
        pricePerUnit: product.price,
        commissionPerUnit: commissionRate,
        paymentMethod: data.paymentMethod,
        salesPlatform: data.salesPlatform,
        customerName: data.customerName,
        notes: data.notes,
        eventNameLocation: data.saleSource === 'Event' ? data.eventNameLocation : null,
        eventDate: data.saleSource === 'Event' ? data.eventDate : null,
        eventTime: data.saleSource === 'Event' ? data.eventTime : null,
    };

    if(data.id && salesData.some(s => s.id == data.id)) {
        const index = salesData.findIndex(s => s.id == data.id);
        salesData[index] = saleObject;
    } else {
        salesData.push(saleObject);
    }
}

function saveVendor(data) {
    const vendorObject = {
        id: data.id ? parseInt(data.id) : Date.now(),
        name: data.name,
        contact: data.contact,
        area: data.area,
        commissionRate: parseFloat(data.commissionRate),
        closureDay: data.closureDay,
        paymentMethod: data.paymentMethod,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        status: data.status
    };

    if(data.id && vendorsData.some(v => v.id == data.id)) {
        const index = vendorsData.findIndex(v => v.id == data.id);
        vendorsData[index] = vendorObject;
    } else {
        vendorsData.push(vendorObject);
    }
}

function saveProduct(data) {
    const productObject = {
        id: data.id ? parseInt(data.id) : Date.now(),
        name: data.name,
        price: parseFloat(data.price)
    };

    if (data.id && productsData.some(p => p.id == data.id)) {
        const index = productsData.findIndex(p => p.id == data.id);
        productsData[index] = productObject;
    } else {
        productsData.push(productObject);
    }
    populateFilters();
}

function deleteItem(type, id) {
    const confirmDialog = document.getElementById('confirm-dialog');
    const title = document.getElementById('confirm-title');
    const message = document.getElementById('confirm-message');

    title.textContent = `Delete ${type}?`;
    message.textContent = `Are you sure you want to permanently delete this ${type}? This action cannot be undone.`;

    confirmDialog.classList.remove('hidden');
    setTimeout(() => confirmDialog.classList.remove('opacity-0'), 10);

    const cancelBtn = document.getElementById('confirm-btn-cancel');
    const okBtn = document.getElementById('confirm-btn-ok');

    const handleConfirm = () => {
        if (type === 'sale') {
            salesData = salesData.filter(item => item.id !== id);
        } else if (type === 'vendor') {
            vendorsData = vendorsData.filter(item => item.id !== id);
             if (appMap) initializeDashboardMap();
        } else if (type === 'product') {
            productsData = productsData.filter(item => item.id !== id);
            populateFilters();
        }
        saveAllDataToLocalStorage();
        changeView(appState.currentView);
        closeDialog();
    };

    const closeDialog = () => {
        confirmDialog.classList.add('opacity-0');
        setTimeout(() => confirmDialog.classList.add('hidden'), 250);
        okBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', closeDialog);
    };

    okBtn.addEventListener('click', handleConfirm, { once: true });
    cancelBtn.addEventListener('click', closeDialog, { once: true });
}

// --- Data Download/Upload ---
function downloadData() {
    const allData = {
        salesData,
        vendorsData,
        productsData
        // inventoryData and usersData removed
    };
    const jsonString = JSON.stringify(allData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nasi_arab_sales_data_backup_${formatDate(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const uploadedData = JSON.parse(e.target.result);

                const dialog = document.getElementById('upload-confirm-dialog');
                dialog.classList.remove('hidden');
                setTimeout(() => dialog.classList.remove('opacity-0'), 10);

                const cancelBtn = document.getElementById('upload-confirm-btn-cancel');
                const okBtn = document.getElementById('upload-confirm-btn-ok');

                const closeUploadDialog = () => {
                    dialog.classList.add('opacity-0');
                    setTimeout(() => dialog.classList.add('hidden'), 250);
                    okBtn.removeEventListener('click', proceedWithUpload);
                    cancelBtn.removeEventListener('click', closeUploadDialog);
                     event.target.value = null;
                };

                const proceedWithUpload = () => {
                    if (uploadedData.salesData && uploadedData.vendorsData && uploadedData.productsData ) {
                        salesData = uploadedData.salesData;
                        vendorsData = uploadedData.vendorsData;
                        productsData = uploadedData.productsData;

                        saveAllDataToLocalStorage();
                        initializeAppLogic();
                        alert('Data uploaded and restored successfully!');
                    } else {
                        alert('Error: Invalid data file structure. Please upload a valid backup file.');
                    }
                    closeUploadDialog();
                };

                okBtn.addEventListener('click', proceedWithUpload, {once: true});
                cancelBtn.addEventListener('click', closeUploadDialog, {once: true});

            } catch (error) {
                console.error('Error parsing uploaded file:', error);
                alert('Error: Could not parse the uploaded file. Please ensure it is a valid JSON backup.');
                event.target.value = null;
            }
        };
        reader.readAsText(file);
    }
}
