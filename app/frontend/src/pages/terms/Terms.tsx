import { useEffect, useState, useContext } from 'react';
import { DefaultButton, PrimaryButton } from '@fluentui/react';
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";

import { getTermsOfUse, acceptTermsOfUse, TermsOfUse } from "../../api";
import { UserContext } from "../../components/UserContext";

import styles from "./Terms.module.css";

const Terms = () => {
    const userContext = useContext(UserContext);
    const { userData, setShouldRefreshContext } = userContext;
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [terms, setTerms] = useState('');
    const [termsVersion, setTermsVersion] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchTerms() {
            try {
                const response: TermsOfUse = await getTermsOfUse();
                const sanitizedTerms = DOMPurify.sanitize(response.content);
                setTerms(sanitizedTerms);
                setTermsVersion(response.version);
            } catch (error) {
                console.error('Error fetching terms:', error);
            }
        }
        fetchTerms();
    }, []);

    const handleAccept = async () => {
        try {
            const success = await acceptTermsOfUse(termsVersion);
            if (success) {
                setTermsAccepted(true);
                setShouldRefreshContext(true);
            } else {
                console.error('Failed to accept terms');
            }
        } catch (error) {
            console.error('Error accepting terms:', error);
        }
    };

    const handleNotAccept = async () => {
        navigate('/logout');
    };

    useEffect(() => {
        if (termsAccepted && userData?.tou_accepted) {
            navigate('/');
        }
    }, [termsAccepted, userData, navigate]);

    return (
        <div className={styles.contentArea}>
            <div dangerouslySetInnerHTML={{ __html: terms }}></div>
            {!userData?.tou_accepted && (
                <div className={styles.buttonContainer}>
                    <PrimaryButton
                        className={styles.acceptButton}
                        onClick={handleAccept}>
                        I Understand & Agree
                    </PrimaryButton>
                    <DefaultButton
                        className={styles.notAcceptButton}
                        onClick={handleNotAccept}>
                        I do not agree
                    </DefaultButton>
                </div>
            )}
        </div>
    );
}

export default Terms;