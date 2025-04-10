const ACTIVITY_TYPES = {
    UPLOAD: 'upload',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    DRAFT: 'draft',
    EDIT: 'edit'
};

async function getRecentActivity() {
    const { data: { user } } = await supabase.auth.getUser();

    // Get releases activity
    const { data: releases } = await supabase
        .from('releases')
        .select('*')
        .eq('artist_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

    // Get drafts activity
    const { data: drafts } = await supabase
        .from('drafts')
        .select('*')
        .eq('user_id', user.id)
        .order('last_saved', { ascending: false })
        .limit(10);

    // Combine and format activities
    const activities = [
        ...releases.map(release => ({
            type: release.review_status === 'pending' ? ACTIVITY_TYPES.UPLOAD : release.review_status,
            message: getActivityMessage(release),
            created_at: release.created_at
        })),
        ...drafts.map(draft => ({
            type: ACTIVITY_TYPES.DRAFT,
            message: `Draft saved: ${draft.form_data.title || 'Untitled Draft'}`,
            created_at: draft.last_saved
        }))
    ];

    // Sort by date and limit to 10 most recent
    return activities
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);
}

function getActivityMessage(release) {
    switch (release.review_status) {
        case 'pending':
            return `Submitted "${release.title}" for review`;
        case 'approved':
            return `"${release.title}" was approved`;
        case 'rejected':
            return `"${release.title}" was rejected`;
        default:
            return `Updated "${release.title}"`;
    }
}

window.getRecentActivity = getRecentActivity;
