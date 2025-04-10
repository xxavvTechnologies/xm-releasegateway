document.addEventListener('DOMContentLoaded', async () => {
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    // Verify admin role
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || profile.role !== 'admin') {
        window.location.href = '/dashboard.html';
        return;
    }

    const releasesGrid = document.querySelector('.releases-grid');
    const pendingBtn = document.getElementById('pendingBtn');
    const approvedBtn = document.getElementById('approvedBtn');
    let currentView = 'pending';

    async function loadReleases(status) {
        const { data, error } = await supabase
            .from('releases')
            .select(`
                *,
                profiles(artist_name)
            `)
            .eq('review_status', status);

        if (error) throw error;

        releasesGrid.innerHTML = data.map(release => `
            <div class="release-card">
                <img src="${release.artwork}" alt="${release.title}">
                <div class="release-info">
                    <h3>${release.title}</h3>
                    <p>By ${release.profiles?.artist_name || 'Unknown Artist'}</p>
                    <p>${release.type} • ${release.genre}</p>
                    <div class="actions">
                        <button onclick="viewDetails('${release.id}')" class="view-btn">View Details</button>
                        ${status === 'pending' ? `
                            <button onclick="approveRelease('${release.id}')" class="approve-btn">Approve</button>
                            <button onclick="rejectRelease('${release.id}')" class="reject-btn">Reject</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    window.viewDetails = async (id) => {
        const { data: release, error } = await supabase
            .from('releases')
            .select(`
                *,
                profiles(artist_name)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error loading release details:', error);
            return;
        }

        const details = document.getElementById('releaseDetails');
        details.innerHTML = `
            <div class="details-content">
                <h2>${release.title}</h2>
                <div class="details-grid">
                    <div class="detail-item">
                        <label>Artist</label>
                        <p>${release.profiles.artist_name}</p>
                    </div>
                    <!-- Add all other fields here -->
                    <div class="detail-item">
                        <label>Admin Notes</label>
                        <textarea id="adminNotes">${release.admin_notes || ''}</textarea>
                    </div>
                </div>
                <div class="details-actions">
                    <button onclick="saveNotes('${release.id}')" class="save-btn">Save Notes</button>
                    <button class="close-btn">Close</button>
                </div>
            </div>
        `;
        details.style.display = 'block';
    };

    window.saveNotes = async (id) => {
        const notes = document.getElementById('adminNotes').value;
        const { error } = await supabase
            .from('releases')
            .update({ admin_notes: notes })
            .eq('id', id);

        if (error) {
            console.error('Error saving notes:', error);
            return;
        }
        alert('Notes saved successfully');
    };

    window.approveRelease = async (id) => {
        const { error } = await supabase
            .from('releases')
            .update({ review_status: 'approved' })
            .eq('id', id);
        if (!error) loadReleases(currentView);
    };

    window.rejectRelease = async (id) => {
        const { error } = await supabase
            .from('releases')
            .update({ review_status: 'rejected' })
            .eq('id', id);
        if (!error) loadReleases(currentView);
    };

    pendingBtn.addEventListener('click', () => {
        currentView = 'pending';
        loadReleases('pending');
        pendingBtn.classList.add('active');
        approvedBtn.classList.remove('active');
    });

    approvedBtn.addEventListener('click', () => {
        currentView = 'approved';
        loadReleases('approved');
        approvedBtn.classList.add('active');
        pendingBtn.classList.remove('active');
    });

    // Initial load
    loadReleases('pending');
});
