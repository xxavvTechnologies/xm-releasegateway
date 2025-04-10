document.addEventListener('DOMContentLoaded', () => {
    const releaseForm = document.getElementById('releaseForm');
    const trackUploadArea = document.getElementById('trackUploadArea');
    const artworkArea = document.getElementById('artworkArea');
    const tracksList = document.getElementById('tracksList');
    const logoutBtn = document.getElementById('logoutBtn');

    let tracks = [];
    let artworkFile = null;
    let currentDraftId = null;
    let autoSaveTimeout = null;

    // Handle logout
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });

    // Handle audio file uploads
    trackUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        trackUploadArea.classList.add('drag-over');
    });

    trackUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        trackUploadArea.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.type === 'audio/wav' || file.type === 'audio/flac');
        files.forEach(handleTrackUpload);
    });

    trackUploadArea.querySelector('input').addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(handleTrackUpload);
    });

    // Handle artwork upload
    artworkArea.querySelector('input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            artworkFile = file;
            artworkArea.querySelector('p').textContent = file.name;
        }
    });

    // Handle form submission
    releaseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(releaseForm);
        
        try {
            // Upload audio files
            const audioUploads = await Promise.all(tracks.map(async track => {
                const fileName = `${Date.now()}-${track.file.name}`;
                const { data, error } = await supabase.storage
                    .from('audio')
                    .upload(fileName, track.file);
                if (error) throw error;
                return data.path;
            }));

            // Upload artwork
            const artworkFileName = `${Date.now()}-artwork.jpg`;
            const { data: artworkData, error: artworkError } = await supabase.storage
                .from('artwork')
                .upload(artworkFileName, artworkFile);
            if (artworkError) throw artworkError;

            // Save release data
            const { data, error } = await supabase
                .from('releases')
                .insert([{
                    title: formData.get('title'),
                    type: formData.get('type'),
                    genre: formData.get('genre'),
                    release_date: formData.get('release_date'),
                    audio_files: audioUploads,
                    artwork: artworkData.path,
                    artist_id: (await supabase.auth.getUser()).data.user.id
                }]);

            if (error) throw error;
            alert('Release submitted successfully!');
            releaseForm.reset();
        } catch (error) {
            alert('Error submitting release: ' + error.message);
        }
    });

    async function handleTrackUpload(file) {
        try {
            // Upload file immediately
            const fileName = `${Date.now()}-${file.name}`;
            const { data, error } = await supabase.storage
                .from('audio')
                .upload(fileName, file);
            
            if (error) throw error;

            const track = {
                file: null, // Don't store file object
                fileName: file.name,
                filePath: data.path,
                title: file.name.replace(/\.(wav|flac)$/i, ''),
                position: tracks.length + 1,
                featuring: '',
                version: '',
                genre: '',
                songwriter: '',
                publisher: '',
                explicit: false,
                properties: []
            };

            tracks.push(track);
            updateTracksList();
            await saveFormProgress(); // Auto-save after upload
            showToast('Track uploaded successfully');
        } catch (error) {
            alert('Error uploading track: ' + error.message);
        }
    }

    function updateTracksList() {
        tracksList.innerHTML = tracks.map((track, index) => `
            <div class="track-item" data-index="${index}">
                <div class="track-header">
                    <span class="track-number">#${track.position}</span>
                    <h3>${track.fileName}</h3>
                    <button type="button" class="delete-track-btn" data-index="${index}">Delete</button>
                </div>
                <div class="track-form">
                    <div class="track-form-group">
                        <label>Track Title</label>
                        <input type="text" placeholder="Track Title" value="${track.title}" required>
                    </div>
                    <div class="track-form-group">
                        <label>Position</label>
                        <input type="number" placeholder="Position" value="${track.position}" min="1">
                    </div>
                    <div class="track-form-group">
                        <label>Featuring Artists</label>
                        <input type="text" placeholder="Featuring Artists" value="${track.featuring || ''}">
                    </div>
                    <div class="track-form-group">
                        <label>Track Version</label>
                        <input type="text" placeholder="Track Version" value="${track.version || ''}">
                    </div>
                    <div class="track-form-group">
                        <label>Genre</label>
                        <select class="track-genre">
                            <option value="">Select Genre</option>
                            ${GENRES.map(g => `
                                <option value="${g}" ${track.genre === g ? 'selected' : ''}>
                                    ${g}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="track-form-group">
                        <label>Songwriter</label>
                        <input type="text" placeholder="Songwriter" value="${track.songwriter || ''}">
                    </div>
                    <div class="track-form-group">
                        <label>Publisher</label>
                        <input type="text" placeholder="Publisher" value="${track.publisher || ''}">
                    </div>
                    <div class="track-form-group track-flags">
                        <label class="checkbox-label">
                            <input type="checkbox" ${track.explicit ? 'checked' : ''}>
                            <span>Explicit Content</span>
                        </label>
                    </div>
                    <div class="track-properties">
                        <label class="properties-label">Track Properties</label>
                        <div class="properties-grid">
                            ${trackProperties.map(prop => `
                                <label class="checkbox-label">
                                    <input type="checkbox" value="${prop}" 
                                        ${track.properties.includes(prop) ? 'checked' : ''}>
                                    <span>${prop}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners for track form inputs
        document.querySelectorAll('.track-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            const inputs = item.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('change', () => updateTrackData(index, input));
            });

            // Add delete button listener
            const deleteBtn = item.querySelector('.delete-track-btn');
            deleteBtn.addEventListener('click', () => deleteTrack(index));
        });
    }

    async function deleteTrack(index) {
        if (!confirm('Are you sure you want to delete this track? This cannot be undone.')) {
            return;
        }

        const track = tracks[index];
        
        try {
            if (track.filePath) {
                // Delete from storage bucket if it was uploaded
                const { error } = await supabase.storage
                    .from('audio')
                    .remove([track.filePath]);
                
                if (error) throw error;
            }

            // Remove from tracks array
            tracks.splice(index, 1);
            
            // Update positions for remaining tracks
            tracks.forEach((t, i) => {
                t.position = i + 1;
            });

            updateTracksList();
            await saveFormProgress(); // Auto-save after deletion
            showToast('Track deleted successfully');
        } catch (error) {
            alert('Error deleting track: ' + error.message);
        }
    }

    const form = document.getElementById('releaseForm');
    const pages = document.querySelectorAll('.form-page');
    const progressSteps = document.querySelectorAll('.progress-step');
    let currentPage = 1;

    // Form controls
    const showAdvanced = document.getElementById('showAdvanced');
    const advancedOptions = document.getElementById('advancedOptions');
    const isRerelease = document.getElementById('isRerelease');
    const rereleaseOptions = document.getElementById('rereleaseOptions');
    const deliverAsap = document.getElementById('deliverAsap');
    const releaseDatePicker = document.getElementById('releaseDatePicker');
    const isExclusive = document.getElementById('isExclusive');
    const exclusiveOptions = document.getElementById('exclusiveOptions');
    const requestCoverArt = document.getElementById('requestCoverArt');
    const coverArtUpload = document.getElementById('coverArtUpload');

    // Track management
    const trackProperties = [
        'Remix', 'Samples Or Stock', 'Mix or Compilation', 'Alternate Version',
        'Special Genre', 'Non Musical Content', 'Includes AI', 'None of these apply'
    ];

    // Initialize dropdowns using constants
    const genreSelect = document.querySelector('select[name="genre"]');
    const languageSelect = document.querySelector('select[name="language"]');

    // Populate genre dropdown
    genreSelect.innerHTML = '<option value="">Select a genre</option>' + 
        GENRES.map(genre => 
            `<option value="${genre}">${genre}</option>`
        ).join('');

    // Populate language dropdown
    languageSelect.innerHTML = '<option value="">Select a language</option>' + 
        LANGUAGES.map(language => 
            `<option value="${language}">${language}</option>`
        ).join('');

    // Add search functionality to selects
    [genreSelect, languageSelect].forEach(select => {
        select.addEventListener('keyup', (e) => {
            const search = e.target.value.toLowerCase();
            Array.from(select.options).forEach(option => {
                const text = option.text.toLowerCase();
                option.style.display = text.includes(search) ? '' : 'none';
            });
        });
    });

    // Form controls event listeners
    showAdvanced.addEventListener('change', () => {
        advancedOptions.style.display = showAdvanced.checked ? 'block' : 'none';
        const inputs = advancedOptions.querySelectorAll('input');
        inputs.forEach(input => input.required = showAdvanced.checked);
    });

    isRerelease.addEventListener('change', () => {
        rereleaseOptions.style.display = isRerelease.checked ? 'block' : 'none';
        const inputs = rereleaseOptions.querySelectorAll('input');
        inputs.forEach(input => input.required = isRerelease.checked);
    });

    deliverAsap.addEventListener('change', () => {
        releaseDatePicker.style.display = deliverAsap.checked ? 'none' : 'block';
        releaseDatePicker.querySelector('input').required = !deliverAsap.checked;
    });

    isExclusive.addEventListener('change', () => {
        exclusiveOptions.style.display = isExclusive.checked ? 'block' : 'none';
        // Clear existing store list to avoid duplicates
        const storeList = exclusiveOptions.querySelector('.store-list');
        if (isExclusive.checked && !storeList.children.length) {
            storeList.innerHTML = DISTRIBUTION_STORES.map(store => `
                <label class="store-item">
                    <input type="checkbox" name="exclusive_stores" value="${store}">
                    <span>${store}</span>
                </label>
            `).join('');
        }
    });

    requestCoverArt.addEventListener('change', () => {
        coverArtUpload.style.display = requestCoverArt.checked ? 'none' : 'block';
        coverArtUpload.querySelector('input').required = !requestCoverArt.checked;
    });

    // Form controls event listeners
    const learnMoreBtn = document.querySelector('.learn-more-btn');
    learnMoreBtn.addEventListener('click', () => {
        // Replace LEARN_MORE_URL with the actual URL when you have it
        window.open('https://musik.xxavvgroup.com/helpcenterarticles/xm-discover-early-pilots-program-(epp)', '_blank');
    });

    // Remove existing modal event listeners
    // ESC key and modal close handlers can be removed

    // Navigation between pages
    document.querySelectorAll('.next-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (validatePage(currentPage)) {
                showPage(currentPage + 1);
            }
        });
    });

    document.querySelectorAll('.prev-btn').forEach(btn => {
        btn.addEventListener('click', () => showPage(currentPage - 1));
    });

    function showPage(pageNum) {
        pages.forEach(page => page.style.display = 'none');
        pages[pageNum - 1].style.display = 'block';
        currentPage = pageNum;

        progressSteps.forEach((step, index) => {
            step.classList.toggle('active', index + 1 <= pageNum);
        });
    }

    function validatePage(pageNum) {
        const currentPageElement = document.querySelector(`[data-page="${pageNum}"]`);
        const requiredFields = currentPageElement.querySelectorAll('[required]');
        
        let valid = true;
        requiredFields.forEach(field => {
            if (!field.value) {
                field.classList.add('error');
                valid = false;
            } else {
                field.classList.remove('error');
            }
        });

        return valid;
    }

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validatePage(currentPage)) return;

        const formData = new FormData(form);
        const { data: { user } } = await supabase.auth.getUser();

        const releaseData = {
            title: formData.get('title'),
            description: formData.get('description'),
            genre: formData.get('genre'),
            language: formData.get('language'),
            primary_artist: formData.get('primaryArtist'),
            secondary_artists: formData.get('secondaryArtists').split(',').map(a => a.trim()).filter(Boolean),
            copyright_holder: formData.get('copyrightHolder'),
            release_version: formData.get('releaseVersion'),
            upc_code: formData.get('upcCode'),
            original_release_date: formData.get('originalReleaseDate'),
            deliver_asap: formData.get('deliverAsap') === 'on',
            release_date: formData.get('releaseDate'),
            enrolled_epp: formData.get('enrollEpp') === 'on',
            is_exclusive: formData.get('isExclusive') === 'on',
            exclusive_stores: isExclusive.checked ? 
                Array.from(document.querySelectorAll('input[name="exclusive_stores"]:checked'))
                    .map(input => input.value) : [],
            exclusive_to_xm: formData.get('exclusiveToXm') === 'on',
            youtube_content_id: formData.get('youtubeContentId') === 'on',
            tracks: tracks,
            review_status: 'pending',
            artist_id: user.id,
            artist_profile_id: user.id, // Add this line
        };

        try {
            // Upload audio files
            const audioUploads = await Promise.all(tracks.map(async track => {
                const fileName = `${Date.now()}-${track.file.name}`;
                const { data, error } = await supabase.storage
                    .from('audio')
                    .upload(fileName, track.file);
                if (error) throw error;
                return data.path;
            }));

            // Upload artwork
            const artworkFileName = `${Date.now()}-artwork.jpg`;
            const { data: artworkData, error: artworkError } = await supabase.storage
                .from('artwork')
                .upload(artworkFileName, artworkFile);
            if (artworkError) throw artworkError;

            releaseData.audio_files = audioUploads;
            releaseData.artwork = artworkData.path;

            // Save release data
            const { error } = await supabase
                .from('releases')
                .insert([releaseData]);

            if (error) throw error;

            // Delete draft if exists
            if (currentDraftId) {
                await supabase
                    .from('drafts')
                    .delete()
                    .eq('id', currentDraftId);
            }

            alert('Release submitted successfully!');
            form.reset();
            tracks = [];
            updateTracksList();
            showPage(1);
        } catch (error) {
            alert('Error submitting release: ' + error.message);
        }
    });

    // Auto-save function
    async function saveFormProgress() {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        // Store tracks without file references
        data.tracks = tracks.map(track => ({
            ...track,
            fileName: track.file?.name || track.fileName, // Keep filename
            file: null // Don't store file object
        }));

        try {
            if (currentDraftId) {
                const { error } = await supabase
                    .from('drafts')
                    .update({
                        form_data: data,
                        last_saved: new Date()
                    })
                    .eq('id', currentDraftId);
                
                if (error) throw error;
            } else {
                const { data: draft, error } = await supabase
                    .from('drafts')
                    .insert([{
                        form_data: data,
                        user_id: (await supabase.auth.getUser()).data.user.id,
                        name: data.title || 'Untitled Draft'
                    }])
                    .select()
                    .single();

                if (error) throw error;
                currentDraftId = draft.id;
            }

            showToast('Progress saved');
        } catch (error) {
            console.error('Error saving draft:', error);
        }
    }

    // Add auto-save on form changes
    form.addEventListener('change', () => {
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(saveFormProgress, 2000);
    });

    // Save as draft button (moved inside DOMContentLoaded)
    const submitBtn = document.querySelector('.submit-btn');
    if (submitBtn) {
        const saveDraftBtn = document.createElement('button');
        saveDraftBtn.type = 'button';
        saveDraftBtn.className = 'save-draft-btn';
        saveDraftBtn.textContent = 'Save as Draft';
        saveDraftBtn.onclick = saveFormProgress;
        submitBtn.parentNode.insertBefore(saveDraftBtn, submitBtn);
    }

    // Toast notification
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Load drafts on page load
    async function loadDrafts() {
        // Check if we're loading a specific draft from URL
        const urlParams = new URLSearchParams(window.location.search);
        const draftId = urlParams.get('draft');
        
        if (!draftId) return; // Only load draft if ID is in URL

        const { data: draft, error } = await supabase
            .from('drafts')
            .select('*')
            .eq('id', draftId)
            .single();

        if (error) {
            console.error('Error loading draft:', error);
            return;
        }

        if (draft) {
            currentDraftId = draft.id;
            Object.entries(draft.form_data).forEach(([key, value]) => {
                const field = form.elements[key];
                if (field && field.type !== 'file') { // Skip file inputs
                    field.value = value;
                }
                // Handle checkbox states
                if (field && field.type === 'checkbox') {
                    field.checked = value;
                }
            });
            if (draft.form_data.tracks) {
                tracks = draft.form_data.tracks.map(track => ({
                    ...track,
                    file: null // Clear file reference as it can't be restored
                }));
                updateTracksList();
            }
        }
    }

    loadDrafts();

    // Modified form submission to clear draft
    const originalSubmit = form.onsubmit;
    form.onsubmit = async (e) => {
        e.preventDefault();
        if (await originalSubmit(e) !== false) {
            if (currentDraftId) {
                await supabase
                    .from('drafts')
                    .delete()
                    .eq('id', currentDraftId);
            }
        }
    }; // Note the semicolon here

    // YouTube Content ID modal handling
    const youtubeContentId = document.getElementById('youtubeContentId');
    const youtubeModal = document.getElementById('youtubeModal');
    const confirmYoutubeBtn = youtubeModal.querySelector('.confirm-btn');
    const cancelYoutubeBtn = youtubeModal.querySelector('.cancel-btn');
    const closeYoutubeBtn = youtubeModal.querySelector('.modal-close');

    youtubeContentId.addEventListener('change', (e) => {
        if (e.target.checked) {
            youtubeModal.style.display = 'flex';
            youtubeContentId.dataset.previousState = 'true';
            youtubeContentId.checked = false;
        }
    });

    confirmYoutubeBtn.addEventListener('click', () => {
        const allChecked = Array.from(youtubeModal.querySelectorAll('input[type="checkbox"]'))
            .every(checkbox => checkbox.checked);
        
        if (allChecked) {
            youtubeContentId.checked = true;
            youtubeModal.style.display = 'none';
        } else {
            alert('Please confirm all requirements before proceeding.');
        }
    });

    cancelYoutubeBtn.addEventListener('click', () => {
        youtubeContentId.checked = false;
        youtubeModal.style.display = 'none';
    });

    closeYoutubeBtn.addEventListener('click', () => {
        youtubeContentId.checked = false;
        youtubeModal.style.display = 'none';
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && youtubeModal.style.display === 'flex') {
            youtubeContentId.checked = false;
            youtubeModal.style.display = 'none';
        }
    });
}); // End of DOMContentLoaded
