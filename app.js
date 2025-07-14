let salesData = [];
let vendorsData = [];
let productsData = [];
// inventoryData removed

let charts = {};
let appMap = null;
let vendorModalMap = null;
let vendorMarker = null;
let currentInvoiceData = null;

let appState = {
    currentView: 'dashboard',
    editingId: null,
    editingType: null,
};

function initializeAppLogic() {
    if (!loadDataFromLocalStorage()) {
        generateAndEnsureDefaultData();
        saveAllDataToLocalStorage();
    } else {
        if (!vendorsData.some(v => v.name === 'Restaurant Direct' && v.status === 'System')) {
            vendorsData.push(
                 { id: Date.now() + 1000, name: 'Restaurant Direct', contact: 'N/A', area: 'Restaurant/Event', commissionRate: 0.00, closureDay: 'None', paymentMethod: 'Internal', status: 'System', latitude: null, longitude: null }
            );
            saveAllDataToLocalStorage();
        }
    }
    initializeViews();
    attachEventListeners();
}

window.onload = () => {
    initializeAppLogic();
};


function initializeViews() {
    changeView('dashboard');
    populateFilters();
    populateInvoiceVendorSelect();
    // Inventory date input removed
}

function attachEventListeners() {
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') hideModal();
    });
     document.getElementById('modal-form').addEventListener('change', (event) => {
        if (event.target.id === 'saleSourceSelector') {
            toggleSaleFormFields(event.target.value);
        }
    });
}
