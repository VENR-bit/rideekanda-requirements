// ===== Supabase Client =====
const { createClient } = supabase;
let db;

function initSupabase() {
    db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ===== Auth =====
async function checkSession() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        showAdmin(session.user);
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
        showToast(error.message, true);
        return;
    }

    showAdmin(data.user);
});

function showAdmin(user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('user-email').textContent = user.email;
    loadAdminItems();
}

async function logout() {
    await db.auth.signOut();
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
}

// ===== Image Upload =====
document.getElementById('item-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const preview = document.getElementById('image-preview');
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
    }
});

async function uploadImage(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `items/${fileName}`;

    const { error } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    return data.publicUrl;
}

// ===== CRUD Operations =====
document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const editId = document.getElementById('edit-id').value;
    const name = document.getElementById('item-name').value.trim();
    const description = document.getElementById('item-desc').value.trim();
    const price = parseFloat(document.getElementById('item-price').value);
    const quantity = parseInt(document.getElementById('item-qty').value) || 1;
    const imageFile = document.getElementById('item-image').files[0];

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = editId ? 'Updating...' : 'Adding...';

    try {
        let image_url = null;

        if (imageFile) {
            image_url = await uploadImage(imageFile);
        }

        const itemData = { name, description, price, quantity };
        if (image_url) itemData.image_url = image_url;

        if (editId) {
            // Update existing
            const { error } = await db
                .from('wishlist_items')
                .update(itemData)
                .eq('id', editId);
            if (error) throw error;
            showToast('Item updated!');
        } else {
            // Insert new
            if (!image_url) itemData.image_url = null;
            const { error } = await db
                .from('wishlist_items')
                .insert([itemData]);
            if (error) throw error;
            showToast('Item added!');
        }

        resetForm();
        loadAdminItems();
    } catch (err) {
        showToast(err.message, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editId ? 'Update Item' : 'Add Item';
    }
});

async function loadAdminItems() {
    const container = document.getElementById('admin-items');

    const { data, error } = await db
        .from('wishlist_items')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color:#ff3b30;">Error loading items.</p>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted);">No items yet. Add your first item above!</p>`;
        return;
    }

    container.innerHTML = data.map(item => `
        <div class="admin-card">
            ${item.image_url
                ? `<img class="admin-card-image" src="${item.image_url}" alt="${escapeHtml(item.name)}">`
                : `<div class="admin-card-image" style="background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--text-muted);">&#128230;</div>`
            }
            <div class="admin-card-body">
                <h4>${escapeHtml(item.name)}</h4>
                <p>${escapeHtml(item.description || 'No description')}</p>
                <p><strong>LKR ${formatCurrency(item.price)}</strong> &times; ${item.quantity} = <strong style="color:var(--accent);">LKR ${formatCurrency(Number(item.price) * (Number(item.quantity) || 1))}</strong></p>
            </div>
            <div class="admin-card-actions">
                <button class="btn btn-small btn-outline" onclick='editItem(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function editItem(item) {
    document.getElementById('edit-id').value = item.id;
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-desc').value = item.description || '';
    document.getElementById('item-price').value = item.price;
    document.getElementById('item-qty').value = item.quantity;
    document.getElementById('form-title').textContent = 'Edit Item';
    document.getElementById('submit-btn').textContent = 'Update Item';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';

    if (item.image_url) {
        const preview = document.getElementById('image-preview');
        preview.src = item.image_url;
        preview.style.display = 'block';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    const { error } = await db
        .from('wishlist_items')
        .delete()
        .eq('id', id);

    if (error) {
        showToast(error.message, true);
        return;
    }

    showToast('Item deleted.');
    loadAdminItems();
}

function cancelEdit() {
    resetForm();
}

function resetForm() {
    document.getElementById('item-form').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('form-title').textContent = 'Add New Item';
    document.getElementById('submit-btn').textContent = 'Add Item';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('image-preview').style.display = 'none';
}

// ===== Utilities =====
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatCurrency(num) {
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = isError ? 'toast error show' : 'toast show';
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    checkSession();
});
