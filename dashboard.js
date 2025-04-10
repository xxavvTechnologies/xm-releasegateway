document.addEventListener('DOMContentLoaded', async () => {
    // Wait for supabase to be initialized
    if (!window.supabase) {
        console.error('Supabase client not initialized');
        return;
    }

    const releasesGrid = document.querySelector('.releases-grid');
    const logoutBtn = document.getElementById('logoutBtn');

    // Check authentication
    try {
        const { data: { user }, error: authError } = await window.supabase.auth.getUser();
        if (!user || authError) {
            window.location.href = '/index.html';
            return;
        }

        const artistName = document.getElementById('artistName');
        const totalReleases = document.getElementById('totalReleases');
        const activeReleases = document.getElementById('activeReleases');
        const pendingReleases = document.getElementById('pendingReleases');
        const sortSelect = document.getElementById('sortReleases');
        const filterSelect = document.getElementById('filterReleases');
        const continueLastDraftBtn = document.getElementById('continueLastDraft');
        const checkStatusBtn = document.getElementById('checkStatus');
        const statusModal = document.getElementById('statusModal');
        const themeToggle = document.getElementById('themeToggle');

        let releases = [];
        let drafts = [];

        const sections = {
            released: 'Released',
            approved: 'Approved',
            pending: 'Awaiting Approval',
            rejected: 'Denied',
            drafts: 'Drafts'
        };

        const sectionTitles = {
            released: 'Released',
            approved: 'Approved',
            pending: 'Awaiting Approval',
            rejected: 'Denied',
            drafts: 'Drafts'
        };

        async function loadContent() {
            try {
                // Load user profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                
                artistName.textContent = profile?.artist_name || 'Artist';

                // Load releases with profile information
                const [releasesRes, draftsRes] = await Promise.all([
                    supabase
                        .from('releases')
                        .select(`
                            *,
                            profiles(artist_name)
                        `)
                        .eq('artist_id', user.id),
                    supabase
                        .from('drafts')
                        .select('*')
                        .eq('user_id', user.id)
                ]);

                releases = releasesRes.data || [];
                drafts = draftsRes.data || [];

                // Update stats
                updateStats();
                // Render releases
                renderReleases();
                // Load activity feed
                loadActivityFeed();
            } catch (error) {
                console.error('Error loading dashboard:', error);
            }
        }

        function updateStats() {
            totalReleases.textContent = releases.length;
            activeReleases.textContent = releases.filter(r => r.review_status === 'approved').length;
            pendingReleases.textContent = releases.filter(r => r.review_status === 'pending').length;
        }

        function renderReleases() {
            const filter = filterSelect.value;
            const sort = sortSelect.value;

            // Special handling for drafts
            if (filter === 'drafts') {
                releasesGrid.innerHTML = `
                    <section class="release-section">
                        <h2>${sectionTitles.drafts}</h2>
                        <div class="release-cards">
                            ${drafts.length ? 
                                drafts.map(item => renderCard(item, true)).join('')
                                : `<p class="no-items">No drafts yet</p>`
                            }
                        </div>
                    </section>`;
                return;
            }

            let filteredReleases = [...releases];

            // Apply filters
            if (filter !== 'all') {
                filteredReleases = releases.filter(r => r.review_status === filter);
            }

            // Apply sorting
            filteredReleases.sort((a, b) => {
                if (sort === 'newest') return new Date(b.created_at) - new Date(a.created_at);
                if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
                return a.title.localeCompare(b.title);
            });

            // Organize by status
            const sections = {
                released: filteredReleases.filter(r => r.review_status === 'released'),
                approved: filteredReleases.filter(r => r.review_status === 'approved'),
                pending: filteredReleases.filter(r => r.review_status === 'pending'),
                rejected: filteredReleases.filter(r => r.review_status === 'rejected')
            };

            // Render all sections
            releasesGrid.innerHTML = Object.entries(sections)
                .map(([status, items]) => `
                    <section class="release-section">
                        <h2>${sectionTitles[status]}</h2>
                        <div class="release-cards">
                            ${items.length ? 
                                items.map(item => renderCard(item, false)).join('')
                                : `<p class="no-items">No ${status} releases</p>`
                            }
                        </div>
                    </section>
                `).join('');
        }

        function getSectionTitle(status) {
            const titles = {
                released: 'Released',
                approved: 'Approved',
                pending: 'Awaiting Approval',
                rejected: 'Denied'
            };
            return titles[status] || status;
        }

        function renderCard(item, isDraft) {
            if (isDraft) {
                return `
                    <div class="release-card draft">
                        <div class="release-info">
                            <h3>${item.form_data.title || 'Untitled Draft'}</h3>
                            <p>Last edited: ${new Date(item.last_saved).toLocaleDateString()}</p>
                            <div class="card-actions">
                                <button onclick="continueDraft('${item.id}')" class="continue-btn">Continue Editing</button>
                                <button onclick="deleteDraft('${item.id}')" class="delete-btn">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="release-card">
                    <img src="${item.artwork}" alt="${item.title}">
                    <div class="release-info">
                        <h3>${item.title}</h3>
                        <p>${item.type} • ${item.genre}</p>
                        <p class="status ${item.review_status}">${item.review_status.toUpperCase()}</p>
                    </div>
                </div>
            `;
        }

        async function loadActivityFeed() {
            const activityList = document.getElementById('activityList');
            const activities = await getRecentActivity();

            activityList.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <span class="activity-icon">${getActivityIcon(activity.type)}</span>
                    <div class="activity-content">
                        <p>${activity.message}</p>
                        <span class="activity-time">${formatTime(activity.created_at)}</span>
                    </div>
                </div>
            `).join('');
        }

        window.continueDraft = (id) => {
            window.location.href = `/submit.html?draft=${id}`;
        };

        window.deleteDraft = async (id) => {
            if (!confirm('Are you sure you want to delete this draft?')) return;
            
            const { error } = await supabase
                .from('drafts')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Error deleting draft: ' + error.message);
                return;
            }

            loadContent();
        };

        // Handle logout
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/index.html';
        });

        // Event listeners
        sortSelect.addEventListener('change', renderReleases);
        filterSelect.addEventListener('change', renderReleases);

        continueLastDraftBtn.addEventListener('click', async () => {
            const lastDraft = drafts[0];
            if (lastDraft) {
                window.location.href = `/submit.html?draft=${lastDraft.id}`;
            } else {
                alert('No drafts available');
            }
        });

        checkStatusBtn.addEventListener('click', () => {
            statusModal.style.display = 'flex';
        });

        // Theme toggle
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            themeToggle.textContent = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
        });

        // Beta banner management
        window.dismissBanner = () => {
            const banner = document.getElementById('betaBanner');
            if (banner) {
                banner.style.animation = 'fadeIn 0.3s ease-in reverse';
                setTimeout(() => banner.remove(), 300);
                localStorage.setItem('betaBannerDismissed', 'true');
            }
        };

        // Check if banner should be shown
        const dismissed = localStorage.getItem('betaBannerDismissed');
        const banner = document.getElementById('betaBanner');
        if (dismissed && banner) {
            banner.remove();
        }

        // Initial load
        loadContent();
    } catch (error) {
        console.error('Authentication error:', error);
        window.location.href = '/index.html';
    }
});

// Helper functions for formatting and icons
function getActivityIcon(type) {
    const icons = {
        upload: '📤',
        approved: '✅',
        rejected: '❌',
        draft: '📝',
        edit: '✏️'
    };
    return icons[type] || '📋';
}

function formatTime(date) {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
        .format(-Math.round((Date.now() - new Date(date)) / 86400000), 'day');
}

// Fix status modal close button
document.querySelector('.modal-close').addEventListener('click', () => {
    statusModal.style.display = 'none';
});

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && statusModal.style.display === 'flex') {
        statusModal.style.display = 'none';
    }
});
