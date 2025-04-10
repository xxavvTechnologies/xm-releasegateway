-- Drop existing tables if they exist
DROP TABLE IF EXISTS releases CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users PRIMARY KEY,
    artist_name TEXT,
    role TEXT DEFAULT 'artist' CHECK (role IN ('artist', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create releases table
CREATE TABLE releases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('single', 'ep', 'album')),
    genre TEXT NOT NULL,
    release_date DATE NOT NULL,
    audio_files TEXT[] NOT NULL,
    artwork TEXT NOT NULL,
    artist_id UUID REFERENCES auth.users NOT NULL,
    artist_profile_id UUID REFERENCES profiles(id),
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT fk_artist_profile FOREIGN KEY (artist_profile_id) REFERENCES profiles(id)
);

-- Add indexes for better performance on Netlify
CREATE INDEX IF NOT EXISTS idx_profiles_artist_name ON profiles(artist_name);
CREATE INDEX IF NOT EXISTS idx_releases_created_at ON releases(created_at);
CREATE INDEX IF NOT EXISTS idx_releases_review_status ON releases(review_status);
CREATE INDEX IF NOT EXISTS idx_releases_artist_id ON releases(artist_id);

-- Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Create policies for releases
CREATE POLICY "Users can view their own releases"
    ON releases FOR SELECT
    USING (auth.uid() = artist_id OR 
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can insert their own releases"
    ON releases FOR INSERT
    WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "Admins can update any release"
    ON releases FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Add Netlify function support policies
CREATE POLICY "Netlify functions can read profiles"
    ON profiles FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "Netlify functions can read releases"
    ON releases FOR SELECT
    USING (auth.role() = 'service_role');