const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // Initialize Supabase client with Netlify environment variables
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        // Handle auth events from Supabase
        const { user, type } = JSON.parse(event.body);

        if (type === 'signup') {
            await supabase.from('profiles').insert([
                { id: user.id, artist_name: user.email.split('@')[0] }
            ]);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Success' })
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message })
        };
    }
};
