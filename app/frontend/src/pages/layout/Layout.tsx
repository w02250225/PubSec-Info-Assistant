// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Outlet, NavLink, Link } from "react-router-dom";

// import { WarningBanner } from "../../components/WarningBanner/WarningBanner";
import qtlogo from "../../assets/qt-logo.png";

import styles from "./Layout.module.css";
// import { Title } from "../../components/Title/Title";

const Layout = () => {
    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                {/* <WarningBanner /> */}
                <div className={styles.headerContainer}>
                    <div className={styles.headerTitleContainer}>
                        <img src={qtlogo} className={styles.headerLogo} />
                        {/* <h3 className={styles.headerTitle}><Title/></h3> */}
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
                            <li className={styles.headerNavLeftMargin}>
                                <a href="/logout" className={styles.headerNavPageLink}>
                                    Logout
                                </a>
                            </li>
                        </ul>
                    </nav>
                </div>
            </header>
            <div className={styles.raibanner}>
                <span className={styles.raiwarning}>AI-generated content may be incorrect</span>
            </div>

            <Outlet />

            <footer>
                {/* <WarningBanner /> */}
            </footer>
        </div>
    );
};

export default Layout;
