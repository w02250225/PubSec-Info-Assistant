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
    const [terms, setTerms] = useState<TermsOfUse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
        // set all elements owning target to target=_blank
        if ('target' in node) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener');
        }
    });

    useEffect(() => {
        async function fetchTerms() {
            try {
                const response: TermsOfUse = await getTermsOfUse();
                const sanitizedTerms = DOMPurify.sanitize(response.content);
                const sanitizedAcceptInstructionInline = DOMPurify.sanitize(response.acceptInstructionInline);
                const sanitizedAcceptInstructionFooter = DOMPurify.sanitize(response.acceptInstructionFooter);
                setTerms({
                    ...response,
                    // Override with sanitized content
                    content: sanitizedTerms,
                    acceptInstructionInline: sanitizedAcceptInstructionInline,
                    acceptInstructionFooter: sanitizedAcceptInstructionFooter,
                    version: response.version,
                });
                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching terms:', error);
                setIsLoading(false);
            }
        }
        fetchTerms();
    }, []);

    const handleAccept = async () => {
        // Ensure that terms is not null or undefined before attempting to access it
        if (!terms) {
            console.error('Terms are not loaded');
            return;
        }

        try {
            const success = await acceptTermsOfUse(terms?.version);
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
        window.location.href = '/logout';
    };

    useEffect(() => {
        if (termsAccepted && userData?.tou_accepted) {
            navigate('/');
        }
    }, [termsAccepted, userData, navigate]);

    const AgreementSection = () => (
        <>
            <Stack.Item className={styles.buttonContainer}>
                <div dangerouslySetInnerHTML={{ __html: terms?.acceptInstructionFooter || "" }} />
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
            ) : terms?.content ? ( // Ensure terms and content are available
                <>
                    <div dangerouslySetInnerHTML={{
                        __html: terms?.content.replace(
                            /\$\$acceptInstruction\$\$/g, // Replace with instructions if not accepted
                            userData?.tou_accepted ? "" : (terms?.acceptInstructionInline || "")
                        )
                    }} />
                    {!userData?.tou_accepted && <AgreementSection />}
                </>
            ) : (
                <p>Error Loading Terms of Use</p>
            )}
        </Stack>
    );

}

export default Terms;