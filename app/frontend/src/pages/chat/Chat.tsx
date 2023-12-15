// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useRef, useState, useEffect, useContext } from "react";
import Coeus from "../../assets/coeus.png";
import { Checkbox, Panel, DefaultButton, TextField, SpinButton, Separator, PanelType, IComboBoxOption, SelectableOptionMenuItemType } from "@fluentui/react";
import { ITag } from '@fluentui/react/lib/Pickers';
import readNDJSONStream from "ndjson-readablestream";
import { BlobServiceClient } from "@azure/storage-blob";

import styles from "./Chat.module.css";
import rlbgstyles from "../../components/ResponseLengthButtonGroup/ResponseLengthButtonGroup.module.css";

import { UserContext } from "../../components/UserContext";
import {
    chatApi, RetrievalMode, ChatAppResponse, ChatAppResponseOrError, ChatAppRequest, ResponseMessage,
    GptDeployment, getGptDeployments, setGptDeployment, getInfoData, GetInfoResponse, PromptTemplate,
    getPromptTemplates, getBlobClientUrl, stopStream, UserData
} from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { SettingsButton } from "../../components/SettingsButton";
import { ModelSettingsButton } from "../../components/ModelSettingsButton"
import { InfoButton } from "../../components/InfoButton";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ResponseLengthButtonGroup } from "../../components/ResponseLengthButtonGroup";
import { ResponseTempSlider } from "../../components/ResponseTempSlider";
import { Tooltips } from "../../components/Tooltips"
import { InfoContent } from "../../components/InfoContent/InfoContent";
import { PromptOverride } from "../../components/PromptOverride";
import { TopPSlider } from "../../components/TopPSlider";
import { FolderPicker } from "../../components/FolderPicker";
import { TagPickerInline } from "../../components/TagPicker";
import { ModelPicker } from "../../components/ModelPicker";
import { PromptTemplatePicker } from "../../components/PromptTemplatePicker";

const Chat = () => {
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
    const [isModelConfigPanelOpen, setIsModelConfigPanelOpen] = useState(false);
    const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);
    const [promptOverride, setPromptOverride] = useState<string>("");
    const [retrieveCount, setRetrieveCount] = useState<number>(5);
    const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>(RetrievalMode.Hybrid);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(true);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [shouldStream, setShouldStream] = useState<boolean>(true);
    const [excludeCategory, setExcludeCategory] = useState<string>("");
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(true);
    const [userPersona, setUserPersona] = useState<string>("an analyst");
    const [systemPersona, setSystemPersona] = useState<string>("an Assistant");
    const [aiPersona, setAiPersona] = useState<string>("");
    // Setting responseLength to 2048 by default, this will effect the default display of the ResponseLengthButtonGroup below.
    // It must match a valid value of one of the buttons in the ResponseLengthButtonGroup.tsx file.
    // If you update the default value here, you must also update the default value in the onResponseLengthChange method.
    const [responseLength, setResponseLength] = useState<number>(2048);
    // Setting responseTemp to 0.4 by default, this will effect the default display of the ResponseTempButtonGroup below.
    // It must match a valid value of one of the buttons in the ResponseTempButtonGroup.tsx file.
    // If you update the default value here, you must also update the default value in the onResponseTempChange method.
    const [responseTemp, setResponseTemp] = useState<number>(0.4);
    const [topP, setTopP] = useState<number>(1.0);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeCitationSourceFile, setActiveCitationSourceFile] = useState<string>();
    const [activeCitationSourceFilePageNumber, setActiveCitationSourceFilePageNumber] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);
    const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<ITag[]>([]);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: ChatAppResponse][]>([]);
    const [streamedAnswers, setStreamedAnswers] = useState<[user: string, response: ChatAppResponse][]>([]);

    const [allGptDeployments, setAllGptDeployments] = useState<GptDeployment[]>([]);
    const [defaultGptDeployment, setdefaultGptDeployment] = useState<string | undefined>(undefined);
    const [selectedGptDeployment, setSelectedGptDeployment] = useState<string | undefined>(undefined);

    const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
    const [selectedPromptTemplate, setSelectedPromptTemplate] = useState<string | null>(null);

    const userContext = useContext(UserContext);
    const userData = userContext?.userData as UserData;

    async function fetchBlobFolderData() {
        // Populate default values for selectedFolders if !is_admin
        if (!userData.is_admin) {
            try {
                const blobClientUrl = await getBlobClientUrl();
                const blobServiceClient = new BlobServiceClient(blobClientUrl);
                var containerClient = blobServiceClient.getContainerClient("upload");
                const delimiter = "/";
                const prefix = "";
                var newSelectedFolders: string[] = ['selectAll'];
                for await (const item of containerClient.listBlobsByHierarchy(delimiter, { prefix, })) {
                    // Check if the item is a folder
                    if (item.kind === "prefix") {
                        // Get the folder name and add to the dropdown list
                        var folderName = item.name.slice(0, -1);
                        const userFolderPattern = /^[^@]+@[^@]+\.[^@]+$/;
                        const isUserFolder = userFolderPattern.test(folderName);

                        // Only show folders if 
                        // - The folder is not a user folder (e.g. "Public") 
                        // - The folder belongs to them
                        if ( !isUserFolder || folderName === userData.userPrincipalName ) {
                            newSelectedFolders.push(folderName);
                        }
                    }
                }
                // Check if the user folder exists in newOptions
                const userFolderExists = newSelectedFolders.some(f => f === userData.userPrincipalName);

                // If it doesn't exist, add it to newSelectedFolders
                if (!userFolderExists) {
                    newSelectedFolders.push(userData.userPrincipalName);
                }

                setSelectedFolders(newSelectedFolders);
            } catch (error) {
                console.log(error);
            }
        }
    }

    const handleAsyncRequest = async (question: string, answers: [string, ChatAppResponse][], setAnswers: Function, responseBody: ReadableStream<any>) => {
        let answer: string = "";
        let askResponse: ChatAppResponse = {} as ChatAppResponse;
        const currentStreamIndex = answers.length;

        const updateState = (newContent: string) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    answer += newContent;
                    const latestResponse: ChatAppResponse = {
                        ...askResponse,
                        choices: [{ ...askResponse.choices[0], message: { content: answer, role: askResponse.choices[0].message.role } }]
                    };
                    setStreamedAnswers([...answers, [question, latestResponse]]);
                    resolve(null);
                }, 33);
            });
        };

        try {
            setIsStreaming(true);
            for await (const event of readNDJSONStream(responseBody)) {
                if (event["choices"] && event["choices"][0]["context"] && event["choices"][0]["context"]["data_points"]) {
                    event["choices"][0]["message"] = event["choices"][0]["delta"];
                    askResponse = event as ChatAppResponse;
                } else if (event["choices"] && event["choices"][0]["delta"]["content"]) {
                    setIsLoading(false);
                    await updateState(event["choices"][0]["delta"]["content"]);
                } else if (event["choices"] && event["choices"][0]["context"]) {
                    // Update context with new keys from latest event
                    askResponse.choices[0].context = { ...askResponse.choices[0].context, ...event["choices"][0]["context"] };
                } else if (event["error"]) {
                    throw Error(event["error"]);
                }
            }
        } finally {
            setIsStreaming(false);
        }
        const fullResponse: ChatAppResponse = {
            ...askResponse,
            choices: [{ ...askResponse.choices[0], message: { content: answer, role: askResponse.choices[0].message.role } }]
        };
        return fullResponse;
    };

    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            const messages: ResponseMessage[] = answers.flatMap(a => [
                { content: a[0], role: "user" },
                { content: a[1].choices[0].message.content, role: "assistant" }
            ]);

            const request: ChatAppRequest = {
                messages: [...messages, { content: question, role: "user" }],
                stream: shouldStream,
                context: {
                    overrides: {
                        retrieval_mode: retrievalMode,
                        semantic_ranker: useSemanticRanker,
                        semantic_captions: useSemanticCaptions,
                        exclude_category: excludeCategory.length === 0 ? undefined : excludeCategory,
                        top: retrieveCount,
                        temperature: responseTemp,
                        prompt_template: promptOverride.length === 0 ? undefined : promptOverride,
                        suggest_followup_questions: useSuggestFollowupQuestions,
                        user_persona: userPersona,
                        system_persona: systemPersona,
                        ai_persona: aiPersona,
                        response_length: responseLength,
                        top_p: topP,
                        selected_folders: selectedFolders.length == 0 ? "All" : selectedFolders.filter(f => f !== 'selectAll').join(","),
                        selected_tags: selectedTags.map(tag => tag.name).join(",")
                    }
                },
                session_state: answers.length ? answers[answers.length - 1][1].choices[0].session_state : null
            };

            const response = await chatApi(request);
            if (!response.body) {
                throw Error("No response body");
            }
            if (shouldStream) {
                const parsedResponse: ChatAppResponse = await handleAsyncRequest(question, answers, setAnswers, response.body);
                setAnswers([...answers, [question, parsedResponse]]);
            } else {
                const parsedResponse: ChatAppResponseOrError = await response.json();
                if (response.status > 299 || !response.ok) {
                    throw Error(parsedResponse.error || "Unknown error");
                }
                setAnswers([...answers, [question, parsedResponse as ChatAppResponse]]);
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setAnswers([]);
        setStreamedAnswers([]);
        setIsLoading(false);
        if (isStreaming) { stopStream() };
        setIsStreaming(false);
    };

    const onResponseLengthChange = (_ev: any) => {
        for (let node of _ev.target.parentNode.childNodes) {
            if (node.value == _ev.target.value) {
                switch (node.value) {
                    case "1024":
                        node.className = `${rlbgstyles.buttonleftactive}`;
                        break;
                    case "2048":
                        node.className = `${rlbgstyles.buttonmiddleactive}`;
                        break;
                    case "3072":
                        node.className = `${rlbgstyles.buttonrightactive}`;
                        break;
                    default:
                        //do nothing
                        break;
                }
            }
            else {
                switch (node.value) {
                    case "1024":
                        node.className = `${rlbgstyles.buttonleft}`;
                        break;
                    case "2048":
                        node.className = `${rlbgstyles.buttonmiddle}`;
                        break;
                    case "3072":
                        node.className = `${rlbgstyles.buttonright}`;
                        break;
                    default:
                        //do nothing
                        break;
                }
            }
        }
        // the or value here needs to match the default value assigned to responseLength above.
        setResponseLength(_ev.target.value as number || 2048)
    };

    const onPromptOverrideChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setPromptOverride(newValue || "");
    };

    const onRetrieveCountChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setRetrieveCount(parseInt(newValue || "5"));
    };

    // const onRetrievalModeChange = (_ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption<RetrievalMode> | undefined, index?: number | undefined) => {
    //     setRetrievalMode(option?.data || RetrievalMode.Hybrid);
    // };

    const onUserPersonaChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setUserPersona(newValue || "");
    }

    const onSystemPersonaChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setSystemPersona(newValue || "");
    }

    const onUseSuggestFollowupQuestionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSuggestFollowupQuestions(!!checked);
    };

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };

    const onShowCitation = (citation: string, citationSourceFile: string, citationSourceFilePageNumber: string, index: number) => {
        setActiveCitation(citation);
        setActiveCitationSourceFile(citationSourceFile);
        setActiveCitationSourceFilePageNumber(citationSourceFilePageNumber);
        setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
        setSelectedAnswer(index);
        setIsAnalysisPanelOpen(true);
    };

    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        setActiveAnalysisPanelTab(tab);
        setSelectedAnswer(index);
        setIsAnalysisPanelOpen(true);
    };

    const onSelectedKeyChanged = (selectedFolders: string[]) => {
        setSelectedFolders(selectedFolders)
    };

    const onSelectedTagsChange = (selectedTags: ITag[]) => {
        setSelectedTags(selectedTags)
    }

    const onAnalysisPanelClose = () => {
        setIsAnalysisPanelOpen(false);
        setActiveAnalysisPanelTab(undefined);
    };

    const onStopClick = async () => {
        try {
            return stopStream();
        } catch (e) {
            console.log(e);
        }
        setIsStreaming(false);
    };

    const onGptDeploymentChange = (deploymentName: string) => {
        const deploymentToUpdate = allGptDeployments.find(d => d.deploymentName === deploymentName);

        if (deploymentToUpdate) {
            setSelectedGptDeployment(deploymentName);
            setGptDeployment(deploymentToUpdate);
        }
    };

    const onPromptTemplatePickerChange = (promptTemplateName: string) => {
        const template = promptTemplates.find(d => d.displayName === promptTemplateName);

        if (template) {
            setSelectedPromptTemplate(template.displayName);
            onGptDeploymentChange(template.deploymentName);
            setResponseLength(template.response_length);
            setResponseTemp(template.temperature);
            setTopP(template.top_p);
            setPromptOverride(template.promptOverride);
        }
    };

    const onResetModelConfig = () => {
        setSelectedPromptTemplate(null);
        onGptDeploymentChange(defaultGptDeployment || "Unknown");
        setResponseLength(2048);
        setResponseTemp(0.4);
        setTopP(1.0);
        setPromptOverride("");
    }

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);
    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "auto" }), [streamedAnswers]);

    useEffect(() => {
        getInfoData()
            .then((response: GetInfoResponse) => {
                setdefaultGptDeployment(response.AZURE_OPENAI_CHATGPT_DEPLOYMENT);
                setSelectedGptDeployment(response.AZURE_OPENAI_CHATGPT_DEPLOYMENT);
            })
            .catch(err => console.log(err.message));

        getGptDeployments()
            .then(setAllGptDeployments)
            .catch(err => console.log(err.message));

        getPromptTemplates()
            .then(setPromptTemplates)
            .catch(err => console.log(err.message));

        fetchBlobFolderData();
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading || isStreaming} />
                <ModelSettingsButton className={styles.commandButton} onClick={() => setIsModelConfigPanelOpen(!isModelConfigPanelOpen)} disabled={isLoading || isStreaming} />
                <SettingsButton className={styles.commandButton} onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)} disabled={isLoading || isStreaming} />
                <InfoButton className={styles.commandButton} onClick={() => setIsInfoPanelOpen(!isInfoPanelOpen)} disabled={isLoading || isStreaming} />
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState}>
                            <img src={Coeus} className={styles.chatLogo} />
                            <h3 className={styles.chatEmptyStateSubtitle}>Ask anything or try an example</h3>
                            <ExampleList onExampleClicked={onExampleClicked} />
                        </div>
                    ) : (
                        <div className={styles.chatMessageStream}>
                            {isStreaming &&
                                streamedAnswers.map((streamedAnswer, index) => (
                                    <div key={index}>
                                        <UserChatMessage message={streamedAnswer[0]} />
                                        <div className={styles.chatMessageGpt}>
                                            <Answer
                                                isStreaming={true}
                                                key={index}
                                                answer={streamedAnswer[1]}
                                                isSelected={false}
                                                onCitationClicked={(c, s, p) => onShowCitation(c, s, p, index)}
                                                onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                                onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                                onFollowupQuestionClicked={q => makeApiRequest(q)}
                                                showFollowupQuestions={useSuggestFollowupQuestions && answers.length - 1 === index}
                                                onAdjustClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
                                                onRegenerateClick={() => makeApiRequest(answers[index][0])}
                                            />
                                        </div>
                                    </div>
                                ))}
                            {!isStreaming &&
                                answers.map((answer, index) => (
                                    <div key={index}>
                                        <UserChatMessage message={answer[0]} />
                                        <div className={styles.chatMessageGpt}>
                                            <Answer
                                                isStreaming={false}
                                                key={index}
                                                question={answer[0]}
                                                answer={answer[1]}
                                                isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                                onCitationClicked={(c, s, p) => onShowCitation(c, s, p, index)}
                                                onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                                onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                                onFollowupQuestionClicked={q => makeApiRequest(q)}
                                                showFollowupQuestions={useSuggestFollowupQuestions && answers.length - 1 === index}
                                                onAdjustClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
                                                onRegenerateClick={() => makeApiRequest(answers[index][0])}
                                            />
                                        </div>
                                    </div>
                                ))}
                            {isLoading && (
                                <>
                                    <UserChatMessage message={lastQuestionRef.current} />
                                    <div className={styles.chatMessageGptMinWidth}>
                                        <AnswerLoading />
                                    </div>
                                </>
                            )}
                            {error ? (
                                <>
                                    <UserChatMessage message={lastQuestionRef.current} />
                                    <div className={styles.chatMessageGptMinWidth}>
                                        <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                    </div>
                                </>
                            ) : null}
                            <div ref={chatMessageStreamEnd} />
                        </div>
                    )}
                    <div className={styles.chatInput}>
                        <QuestionInput
                            clearOnSend
                            placeholder="What is the Queensland Government's plan to support women in leadership roles?"
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question)}
                            onInfoClick={() => setIsInfoPanelOpen(!isInfoPanelOpen)}
                            clearChatDisabled={!lastQuestionRef.current || isLoading || isStreaming}
                            onClearClick={clearChat}
                            onStopClick={onStopClick}
                            isStreaming={isStreaming}
                        />
                    </div>
                </div>
                {answers.length > 0 && answers[selectedAnswer].length > 0 && activeAnalysisPanelTab && (
                    <Panel
                        type={PanelType.large}
                        isOpen={isAnalysisPanelOpen}
                        isBlocking={true}
                        onDismiss={() => onAnalysisPanelClose()}
                        closeButtonAriaLabel="Close"
                        onRenderFooterContent={() => <DefaultButton onClick={() => onAnalysisPanelClose()}>Close</DefaultButton>}
                        isFooterAtBottom={true}>
                        <AnalysisPanel
                            activeCitation={activeCitation}
                            sourceFile={activeCitationSourceFile}
                            pageNumber={activeCitationSourceFilePageNumber}
                            onActiveTabChanged={x => onToggleTab(x, selectedAnswer)}
                            answer={answers[selectedAnswer][1]}
                            activeTab={activeAnalysisPanelTab}
                        />
                    </Panel>
                )}
                <Panel
                    type={PanelType.smallFixedFar}
                    headerText="Model Settings"
                    isOpen={isModelConfigPanelOpen}
                    isBlocking={true}
                    onDismiss={() => setIsModelConfigPanelOpen(false)}
                    closeButtonAriaLabel="Close"
                    onRenderFooterContent={() =>
                        <div>
                            <DefaultButton onClick={() => setIsModelConfigPanelOpen(false)}>Close</DefaultButton>
                            <DefaultButton onClick={() => onResetModelConfig()}>Reset</DefaultButton>
                        </div>
                    }
                    isFooterAtBottom={true}>
                    <PromptTemplatePicker
                        className={styles.chatSettingsSeparator}
                        promptTemplates={promptTemplates}
                        selectedTemplate={selectedPromptTemplate}
                        onChange={onPromptTemplatePickerChange}
                    />
                    {selectedGptDeployment && (
                        <ModelPicker
                            className={styles.chatSettingsSeparator}
                            deployments={allGptDeployments}
                            selectedGptDeployment={selectedGptDeployment}
                            onGptDeploymentChange={onGptDeploymentChange}
                        />
                    )}
                    <ResponseLengthButtonGroup
                        className={styles.chatSettingsSeparator}
                        onClick={onResponseLengthChange}
                        value={responseLength}
                    />
                    <ResponseTempSlider
                        className={styles.chatSettingsSeparator}
                        onChange={setResponseTemp}
                        value={responseTemp}
                    />
                    <TopPSlider
                        className={styles.chatSettingsSeparator}
                        onChange={setTopP}
                        value={topP}
                    />
                    <PromptOverride
                        className={styles.chatSettingsSeparator}
                        value={promptOverride}
                        onChange={onPromptOverrideChange}
                    />
                </Panel>
                <Panel
                    type={PanelType.smallFixedFar}
                    headerText="Adjust answer generation"
                    isOpen={isConfigPanelOpen}
                    isBlocking={true}
                    onDismiss={() => setIsConfigPanelOpen(false)}
                    closeButtonAriaLabel="Close"
                    onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>Close</DefaultButton>}
                    isFooterAtBottom={true}>
                    <SpinButton
                        className={styles.chatSettingsSeparator}
                        label="Documents to retrieve from search:"
                        min={1}
                        max={50}
                        defaultValue={retrieveCount.toString()}
                        onChange={onRetrieveCountChange}
                    />
                    <Checkbox
                        className={styles.chatSettingsSeparator}
                        checked={useSuggestFollowupQuestions}
                        label="Suggest follow-up questions"
                        onChange={onUseSuggestFollowupQuestionsChange}
                    />
                    <TextField
                        className={styles.chatSettingsSeparator}
                        defaultValue={userPersona}
                        label="User Persona"
                        onChange={onUserPersonaChange}
                        errorMessage={userPersona.length == 0 ? "Please provide a value" : undefined}
                    />
                    <TextField
                        className={styles.chatSettingsSeparator}
                        defaultValue={systemPersona}
                        label="System Persona"
                        onChange={onSystemPersonaChange}
                        errorMessage={systemPersona.length == 0 ? "Please provide a value" : undefined}
                    />
                    <Separator
                        className={styles.chatSettingsSeparator}>
                        Filter Search Results
                    </Separator>
                    <FolderPicker
                        allowFolderCreation={false}
                        onSelectedKeyChange={onSelectedKeyChanged}
                        selectedKeys={selectedFolders}
                        userData={userData}
                    />
                    <TagPickerInline
                        allowNewTags={false}
                        onSelectedTagsChange={onSelectedTagsChange}
                        preSelectedTags={selectedTags}
                    />
                </Panel>
                <Panel
                    type={PanelType.smallFixedFar}
                    headerText="Information"
                    isOpen={isInfoPanelOpen}
                    isBlocking={true}
                    onDismiss={() => setIsInfoPanelOpen(false)}
                    closeButtonAriaLabel="Close"
                    onRenderFooterContent={() => <DefaultButton onClick={() => setIsInfoPanelOpen(false)}>Close</DefaultButton>}
                    isFooterAtBottom={true}>
                    <InfoContent />
                </Panel>
                <Tooltips />
            </div>
        </div>
    );
};

export default Chat;