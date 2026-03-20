// ===== Supabase Client Setup =====
const { createClient } = supabase;
let db;

function initSupabase() {
    db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ===== Load & Render Wishlist =====
async function loadWishlist() {
    const grid = document.getElementById('wishlist-grid');
    const emptyState = document.getElementById('empty-state');

    try {
        const { data, error } = await db
            .from('wishlist_items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        window._wishlistData = data;
        renderCards(data);
    } catch (err) {
        grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#ff3b30;">
            Failed to load wishlist. Check your Supabase config.</p>`;
        console.error(err);
    }
}

function renderCards(items) {
    const grid = document.getElementById('wishlist-grid');
    const emptyState = document.getElementById('empty-state');

    if (items.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';

    grid.innerHTML = items.map(item => {
        const unitPrice = Number(item.price);
        const qty = Number(item.quantity) || 1;
        const totalCost = unitPrice * qty;
        return `
        <div class="card">
            ${item.image_url
                ? `<img class="card-image" src="${item.image_url}" alt="${escapeHtml(item.name)}" loading="lazy">`
                : `<div class="card-image placeholder">&#128230;</div>`
            }
            <div class="card-body">
                <h3 class="card-title">${escapeHtml(item.name)}</h3>
                <p class="card-description">${escapeHtml(item.description || '')}</p>
                <div class="card-pricing">
                    <div class="pricing-row">
                        <span class="pricing-label">Unit Price</span>
                        <span class="pricing-value">LKR ${formatCurrency(unitPrice)}</span>
                    </div>
                    <div class="pricing-row">
                        <span class="pricing-label">Quantity</span>
                        <span class="pricing-value">${qty}</span>
                    </div>
                    <div class="pricing-row pricing-total">
                        <span class="pricing-label">Total</span>
                        <span class="pricing-value">LKR ${formatCurrency(totalCost)}</span>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');

    // Update grand total summary
    updateGrandTotal(items);
}

// ===== Search & Sort =====
function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');

    if (!searchInput || !sortSelect) return;

    searchInput.addEventListener('input', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
}

function applyFilters() {
    let items = [...(window._wishlistData || [])];
    const query = document.getElementById('searchInput').value.toLowerCase();
    const sort = document.getElementById('sortSelect').value;

    // Filter
    if (query) {
        items = items.filter(i =>
            i.name.toLowerCase().includes(query) ||
            (i.description || '').toLowerCase().includes(query)
        );
    }

    // Sort
    switch (sort) {
        case 'price-low':
            items.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            items.sort((a, b) => b.price - a.price);
            break;
        case 'name':
            items.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'newest':
        default:
            items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    renderCards(items);
}

// ===== Grand Total =====
function updateGrandTotal(items) {
    const summaryEl = document.getElementById('grand-total-summary');
    if (!summaryEl) return;

    if (!items || items.length === 0) {
        summaryEl.style.display = 'none';
        return;
    }

    const totalItems = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const grandTotal = items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 1;
        return sum + (Number(item.price) * qty);
    }, 0);

    document.getElementById('summary-items-count').textContent = items.length;
    document.getElementById('summary-qty-count').textContent = totalItems;
    document.getElementById('summary-grand-total').textContent = `LKR ${formatCurrency(grandTotal)}`;
    summaryEl.style.display = 'flex';
}

// ===== Utility =====
function formatCurrency(num) {
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    loadWishlist();
    setupFilters();
});
