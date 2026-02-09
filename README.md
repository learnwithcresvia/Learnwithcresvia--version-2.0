# 🎓 LearnWithCresvia

A modern college learning and coding platform built with React, Vite, and Supabase.

## ✨ Features

- 🔐 **Complete Authentication System**
  - Email/Password signup and login
  - Email verification
  - Session persistence
  - Password strength indicator
  - Form validation

- 🎨 **Beautiful UI/UX**
  - Modern gradient design
  - Responsive layout (mobile-first)
  - Smooth animations
  - Professional styling

- 👥 **Role-Based Access Control**
  - STUDENT
  - STAFF
  - COORDINATOR
  - HOD
  - ADMIN

- 📊 **User Profiles**
  - XP tracking
  - Streak system
  - Department assignment
  - Year tracking

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Supabase account
- Git

### Installation

1. **Clone/Extract the project**
   ```bash
   cd learnwithcresvia
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

4. **Set up Supabase database**
   
   Run these SQL commands in your Supabase SQL Editor:

   ```sql
   -- Create profiles table
   CREATE TABLE public.profiles (
     id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
     email TEXT NOT NULL,
     name TEXT,
     role TEXT NOT NULL DEFAULT 'STUDENT',
     department TEXT,
     year INTEGER,
     xp INTEGER DEFAULT 0,
     streak INTEGER DEFAULT 0,
     last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     
     CONSTRAINT valid_role CHECK (role IN ('STUDENT', 'STAFF', 'COORDINATOR', 'HOD', 'ADMIN'))
   );

   -- Enable RLS
   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

   -- Create policies
   CREATE POLICY "Enable insert for authentication"
   ON public.profiles FOR INSERT
   WITH CHECK (true);

   CREATE POLICY "Enable read access for all users"
   ON public.profiles FOR SELECT
   USING (true);

   CREATE POLICY "Enable update for users based on id"
   ON public.profiles FOR UPDATE
   USING (auth.uid() = id);

   -- Create trigger function
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS TRIGGER 
   SECURITY DEFINER
   SET search_path = public
   LANGUAGE plpgsql
   AS $$
   BEGIN
     INSERT INTO public.profiles (id, email, role)
     VALUES (NEW.id, NEW.email, 'STUDENT');
     RETURN NEW;
   EXCEPTION WHEN OTHERS THEN
     RAISE LOG 'Error creating profile: %', SQLERRM;
     RAISE;
   END;
   $$;

   -- Create trigger
   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW
     EXECUTE FUNCTION public.handle_new_user();
   ```

5. **Configure Supabase Auth (Optional)**
   
   In Supabase Dashboard → Authentication → Settings:
   - Disable email confirmation for testing (can re-enable later)
   - Set redirect URL: `http://localhost:3000/auth/callback`

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
learnwithcresvia/
├── src/
│   ├── components/       # Reusable components
│   │   └── Loading.jsx
│   ├── contexts/         # React contexts
│   │   └── AuthContext.jsx
│   ├── hooks/            # Custom hooks
│   │   └── useAuth.js
│   ├── pages/            # Page components
│   │   ├── HomePage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── SignupPage.jsx
│   │   ├── TestAuthPage.jsx
│   │   └── NotFound.jsx
│   ├── styles/           # CSS files
│   │   ├── index.css
│   │   └── auth.css
│   ├── utils/            # Utility functions
│   │   └── supabaseClient.js
│   ├── App.jsx           # Main app component
│   └── main.jsx          # Entry point
├── .env                  # Environment variables
├── .env.example          # Environment template
├── index.html            # HTML template
├── package.json          # Dependencies
├── vite.config.js        # Vite configuration
└── README.md             # This file
```

## 🧪 Testing

### Test Authentication

1. **Sign Up**
   - Go to `/signup`
   - Create account with email/password
   - Check email for confirmation (if enabled)
   - Verify profile created in Supabase

2. **Sign In**
   - Go to `/login`
   - Enter credentials
   - Should redirect to homepage
   - Session persists on refresh

3. **Sign Out**
   - Click sign out button
   - Should clear session
   - Redirect to login

### Test Routes

- `/` - Homepage
- `/login` - Login page
- `/signup` - Signup page
- `/test-auth` - Testing page (remove in production)

## 🔧 Configuration

### Tech Stack

- **Frontend**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Backend**: Supabase
- **Styling**: CSS (no framework)

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key |

## 🚧 Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Adding New Features

1. Create component in appropriate directory
2. Update routes in `App.jsx`
3. Add styles in `styles/` directory
4. Test functionality

## 📝 Next Steps

- [ ] Add password reset functionality
- [ ] Create role-specific dashboards
- [ ] Add course management
- [ ] Implement code editor
- [ ] Add Judge0 integration
- [ ] Build student progress tracking
- [ ] Create admin panel

## 🐛 Troubleshooting

### Common Issues

**Loading screen stuck:**
- Check browser console for errors
- Verify Supabase credentials in `.env`
- Clear browser cache and local storage

**Sign up not working:**
- Check Supabase database trigger
- Verify RLS policies
- Check browser console for errors

**Session not persisting:**
- Verify supabaseClient.js configuration
- Check browser local storage
- Ensure `persistSession: true`

## 📄 License

This project is for educational purposes.

## 👥 Contributors

- Your Name - Initial work

## 🙏 Acknowledgments

- Supabase for backend infrastructure
- React team for the framework
- Vite for blazing-fast builds
