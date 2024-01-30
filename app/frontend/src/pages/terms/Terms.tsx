import { useEffect, useState, useContext } from 'react';
import { DefaultButton, PrimaryButton, Stack, Spinner, SpinnerSize } from '@fluentui/react';
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
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchTerms() {
            try {
                const response: TermsOfUse = await getTermsOfUse();
                const sanitizedTerms = DOMPurify.sanitize(response.content);
                setTerms(sanitizedTerms);
                setTermsVersion(response.version);
                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching terms:', error);
                setIsLoading(false);
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

    const AgreementSection = () => (
        <>
            <Stack.Item className={styles.buttonContainer}>
                <strong>
                    Please confirm your understanding of and agreement to these T&Cs by clicking on the "I Understand & Agree" button below.
                    If you do not wish to assess Coeus, please click on the "I do not agree" button and cease using Coeus.
                </strong>
            </Stack.Item>
            <Stack.Item className={styles.buttonContainer}>
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
            </Stack.Item>
        </>
    );

    return (
        <Stack className={styles.contentArea}>
            {isLoading ? (
                <Spinner size={SpinnerSize.large} label="Loading Data..." ariaLive="assertive" labelPosition="right" />
            ) : (
                <>
                    <div dangerouslySetInnerHTML={{ __html: terms }} />
                    {!userData?.tou_accepted && <AgreementSection />}
                </>
            )}
        </Stack>
    );
}

export default Terms;