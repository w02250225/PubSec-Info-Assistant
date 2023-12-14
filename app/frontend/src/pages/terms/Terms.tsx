import { useEffect, useState, useContext } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";

import { getTermsOfUse, acceptTermsOfUse } from "../../api";
import { UserContext } from "../../components/UserContext";

import styles from "./Terms.module.css";

const Terms = () => {
    const userContext = useContext(UserContext);
    const { userData, setShouldRefreshContext } = userContext;
    const [terms, setTerms] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchTerms() {
            try {
                const response = await getTermsOfUse();
                const termsData = await response.json();
                const sanitizedTerms = DOMPurify.sanitize(termsData.content);
                setTerms(sanitizedTerms);
            } catch (error) {
                console.error('Error fetching terms:', error);
            }
        }
        fetchTerms();
    }, []);

    const handleAccept = async () => {
        try {
            const success = await acceptTermsOfUse();

            if (success) {
                setShouldRefreshContext(true);
                navigate('/');
            } else {
                console.error('Failed to accept terms');
            }
        } catch (error) {
            console.error('Error accepting terms:', error);
        }
    };

    return (
        <div className={styles.contentArea}>
            <div dangerouslySetInnerHTML={{ __html: terms }}></div>
            {!userData?.tou_accepted && (
                <PrimaryButton onClick={handleAccept}>Accept Terms</PrimaryButton>
            )}
        </div>
    );
}

export default Terms;