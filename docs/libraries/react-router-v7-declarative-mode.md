# React Router v7 Declarative Mode Guide

Genereted by Claude: https://claude.ai/chat/73fa8511-6bfa-4987-9276-9679f07905c7

## Overview

Declarative mode enables basic routing features like matching URLs to components, navigating around the app, and providing active states with APIs like `<Link>`, `useNavigate`, and `useLocation`.

## Setup

Routes are configured by rendering `<Routes>` and `<Route>` that couple URL segments to UI elements.

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import App from "./app";

const root = document.getElementById("root");
ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
    </Routes>
  </BrowserRouter>
);
```

## Basic Route Configuration

```jsx
<Routes>
  <Route index element={<Home />} />
  <Route path="about" element={<About />} />
  <Route path="concerts">
    <Route index element={<ConcertsHome />} />
    <Route path=":city" element={<City />} />
    <Route path="trending" element={<Trending />} />
  </Route>
</Routes>
```

## Nested Routes

The path of the parent is automatically included in the child, so this config creates both "/dashboard" and "/dashboard/settings" URLs.

```jsx
<Routes>
  <Route path="dashboard" element={<Dashboard />}>
    <Route index element={<Home />} />
    <Route path="settings" element={<Settings />} />
  </Route>
</Routes>
```

Child routes are rendered through the `<Outlet/>` in the parent route.

```jsx
import { Outlet } from "react-router";

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* will either be <Home/> or <Settings/> */}
      <Outlet />
    </div>
  );
}
```

## Layout Routes

Routes without a path create new nesting for their children, but they don't add any segments to the URL.

```jsx
<Routes>
  <Route element={<MarketingLayout />}>
    <Route index element={<MarketingHome />} />
    <Route path="contact" element={<Contact />} />
  </Route>
</Routes>
```

## Index Routes

Index routes render into their parent's `<Outlet/>` at their parent's URL (like a default child route). They are configured with the `index` prop.

```jsx
<Routes>
  <Route path="/" element={<Root />}>
    {/* renders into the outlet in <Root> at "/" */}
    <Route index element={<Home />} />
    <Route path="dashboard" element={<Dashboard />}>
      {/* renders into the outlet in <Dashboard> at "/dashboard" */}
      <Route index element={<DashboardHome />} />
      <Route path="settings" element={<Settings />} />
    </Route>
  </Route>
</Routes>
```

## Dynamic Segments

If a path segment starts with `:` then it becomes a "dynamic segment". When the route matches the URL, the dynamic segment will be parsed from the URL and provided as params to other router APIs like `useParams`.

```jsx
<Route path="teams/:teamId" element={<Team />} />

// In the component:
import { useParams } from "react-router";

export default function Team() {
  let params = useParams();
  // params.teamId
}
```

Multiple dynamic segments:
```jsx
<Route path="/c/:categoryId/p/:productId" element={<Product />} />

// In the component:
import { useParams } from "react-router";

export default function CategoryProduct() {
  let { categoryId, productId } = useParams();
  // ...
}
```

## Optional Segments

You can make a route segment optional by adding a `?` to the end of the segment.

```jsx
<Route path=":lang?/categories" element={<Categories />} />
<Route path="users/:userId/edit?" element={<User />} />
```

## Star Segments (Splat Routes)

If a route path pattern ends with `/*` then it will match any characters following the `/`, including other `/` characters.

```jsx
<Route path="files/*" element={<File />} />

// In the component:
let params = useParams();
// params["*"] will contain the remaining URL after files/
let filePath = params["*"];

// Or destructure with a custom name:
let { "*": splat } = useParams();
```

## Navigation

### NavLink (for navigation with active states)

This component is for navigation links that need to render an active state.

```jsx
import { NavLink } from "react-router";

export function MyAppNav() {
  return (
    <nav>
      <NavLink to="/" end>Home</NavLink>
      <NavLink to="/trending" end>Trending Concerts</NavLink>
      <NavLink to="/concerts">All Concerts</NavLink>
      <NavLink to="/account">Account</NavLink>
    </nav>
  );
}
```

Whenever a NavLink is active, it will automatically have an `.active` class name for easy styling with CSS.

Conditional styling:
```jsx
// className callback
<NavLink
  to="/messages"
  className={({ isActive }) =>
    isActive ? "text-red-500" : "text-black"
  }
>
  Messages
</NavLink>

// style callback
<NavLink
  to="/messages"
  style={({ isActive }) => ({
    color: isActive ? "red" : "black",
  })}
>
  Messages
</NavLink>

// children callback
<NavLink to="/message">
  {({ isActive }) => (
    <span className={isActive ? "active" : ""}>
      {isActive ? "👉" : ""} Tasks
    </span>
  )}
</NavLink>
```

### Link (for simple navigation)

Use `<Link>` when the link doesn't need active styling.

```jsx
import { Link } from "react-router";

export function LoggedOutMessage() {
  return (
    <p>
      You've been logged out.{" "}
      <Link to="/login">Login again</Link>
    </p>
  );
}
```

### useNavigate (programmatic navigation)

This hook allows the programmer to navigate the user to a new page without the user interacting.

Reserve usage of `useNavigate` to situations where the user is not interacting but you need to navigate, for example after form submission or authentication.

```jsx
import { useNavigate } from "react-router";

export function LoginPage() {
  let navigate = useNavigate();

  return (
    <>
      <MyHeader />
      <MyLoginForm
        onSuccess={() => {
          navigate("/dashboard");
        }}
      />
      <MyFooter />
    </>
  );
}
```

## URL Values

### Route Params

Route params are the parsed values from a dynamic segment.

```jsx
<Route path="/concerts/:city" element={<City />} />

// In the component:
import { useParams } from "react-router";

function City() {
  let { city } = useParams();
  let data = useFakeDataLibrary(`/api/v2/cities/${city}`);
  // ...
}
```

### Search Params

Search params are the values after a `?` in the URL. They are accessible from `useSearchParams`, which returns an instance of URLSearchParams.

```jsx
import { useSearchParams } from "react-router";

function SearchResults() {
  let [searchParams] = useSearchParams();
  return (
    <div>
      <p>
        You searched for <i>{searchParams.get("q")}</i>
      </p>
      <FakeSearchResults />
    </div>
  );
}
```

### Location

React Router creates a custom location object with some useful information on it accessible with `useLocation`.

```jsx
import { useLocation } from "react-router";

function useAnalytics() {
  let location = useLocation();
  useEffect(() => {
    sendFakeAnalytics(location.pathname);
  }, [location]);
}

function useScrollRestoration() {
  let location = useLocation();
  useEffect(() => {
    fakeRestoreScroll(location.key);
  }, [location]);
}
```

## Key Points for Declarative Mode

- Use `<BrowserRouter>` as the root router component
- Define routes declaratively with `<Routes>` and `<Route>` components
- Use `<Outlet />` in parent components to render child routes
- Use `useParams()` to access dynamic route parameters
- Use `useSearchParams()` to access query string parameters
- Use `useLocation()` to access current location information
- Use `<NavLink>` for navigation with active states, `<Link>` for simple navigation
- Use `useNavigate()` for programmatic navigation (sparingly)
- Index routes act as default children at the parent's URL
