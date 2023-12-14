// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import React, { useContext } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";

import { initializeIcons } from "@fluentui/react";

import "./index.css";

import { UserProvider } from "./components/UserContext";
import Layout from "./pages/layout/Layout";
import NoPage from "./pages/NoPage";
import Chat from "./pages/chat/Chat";
import Content from "./pages/content/Content";
import Terms from "./pages/terms/Terms"
import ViewDocument from "./pages/document/ViewDocument"

initializeIcons();

export default function App() {
    return (
        <UserProvider>
            <HashRouter>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Chat />} />
                        <Route path="Content" element={<Content />} />
                        <Route path="Terms" element={<Terms />} />
                        <Route path="ViewDocument/*" element={<ViewDocument />} />
                        <Route path="*" element={<NoPage />} />
                    </Route>
                </Routes>
            </HashRouter>
        </UserProvider>
    );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
