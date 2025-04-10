// Ensure supabaseJs is defined before using
if (typeof supabaseJs === 'undefined') {
    console.error('Supabase client library not loaded');
    // Create a dummy client to prevent crashes
    window.supabase = {
        auth: { getUser: () => ({ data: null, error: new Error('Client not initialized') }) },
        from: () => ({ select: () => ({ data: null, error: new Error('Client not initialized') }) })
    };
} else {
    // Supabase configuration
    const supabaseUrl = 'https://httoloijwnlrfslkwkfo.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dG9sb2lqd25scmZzbGt3a2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNDMwMDgsImV4cCI6MjA1OTcxOTAwOH0.1C2taQyRFhKDJ8kiildOC8pt6tDwNCL1vMjG804yKmU';

    // Create Supabase client
    const supabase = supabaseJs.createClient(supabaseUrl, supabaseAnonKey, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        persistSession: true,
        autoRefreshToken: true
    });

    // Add error handler for API requests
    supabase.handleError = async (error) => {
        console.error('Supabase error:', error);
        if (error.status === 406) {
            const session = await supabase.auth.getSession();
            if (!session) {
                window.location.href = '/index.html';
                return;
            }
            return true; // indicates retry
        }
        return false; // no retry
    };

    // Add proper base URL handler for Netlify
    const getBaseUrl = () => {
        if (typeof window !== 'undefined') {
            return window.location.origin;
        }
        return process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    };

    supabase.baseUrl = getBaseUrl();
    
    // Initialize global supabase with retry
    let retries = 0;
    const initSupabase = () => {
        if (retries > 5) {
            console.error('Failed to initialize Supabase after 5 retries');
            return;
        }
        try {
            window.supabase = supabase;
            console.log('Supabase client initialized');
        } catch (err) {
            retries++;
            setTimeout(initSupabase, 100);
        }
    };
    
    initSupabase();
}
