document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const googleBtn = document.querySelector('.google-btn');

    // Check if user is already logged in
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            window.location.href = '/dashboard.html';
        }
    });

    async function handleLoginSuccess(user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role === 'admin') {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/dashboard.html';
        }
    }

    // Handle email login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('input[type="email"]').value;
        const password = loginForm.querySelector('input[type="password"]').value;

        try {
            const { data: { user }, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            await handleLoginSuccess(user);
        } catch (error) {
            alert('Error logging in: ' + error.message);
        }
    });

    // Handle Google login
    googleBtn.addEventListener('click', async () => {
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google'
            });
            if (error) throw error;
            // OAuth callback will handle routing
        } catch (error) {
            alert('Error logging in with Google: ' + error.message);
        }
    });
});
