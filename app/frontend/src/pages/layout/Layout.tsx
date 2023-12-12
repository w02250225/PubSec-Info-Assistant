// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useState, useEffect, useContext } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";

import qtlogo from "../../assets/qt-logo.png";
import { UserInfoMenu } from "../../components/UserInfoMenu"

import styles from "./Layout.module.css";
import { UserData } from "../../api"
import { UserContext } from "../../components/UserContext";

const Layout = () => {
    const userContext = useContext(UserContext);
    const userData = userContext?.userData as UserData;

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerContainer}>
                    <div className={styles.headerTitleContainer}>
                        <img src={qtlogo} className={styles.headerLogo} />
                    </div>
                    <nav>
                        <ul className={styles.headerNavList}>
                            <li>
                                <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Chat
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/content" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Manage Content
                                </NavLink>
                            </li>
                        </ul>
                    </nav>
                    {userData && (
                        <UserInfoMenu userData={userData} />
                    )}
                </div>
            </header>
            <div className={styles.raibanner}>
                <span className={styles.raiwarning}>AI-generated content may be incorrect</span>
            </div>

            <Outlet />

        </div>
    );
};

export default Layout;
