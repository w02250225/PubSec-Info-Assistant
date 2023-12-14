// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useRef, useState, useEffect, useContext } from "react";
import Coeus from "../../assets/coeus.png";
import { Checkbox, Panel, DefaultButton, TextField, SpinButton, Separator, PanelType } from "@fluentui/react";
import { ITag } from '@fluentui/react/lib/Pickers';
import readNDJSONStream from "ndjson-readablestream";

import styles from "./Chat.module.css";
import rlbgstyles from "../../components/ResponseLengthButtonGroup/ResponseLengthButtonGroup.module.css";

import { UserContext } from "../../components/UserContext";
import {
    chatApi, RetrievalMode, ChatAppResponse, ChatAppResponseOrError, ChatAppRequest, ResponseMessage,
    GptDeployment, getGptDeployments, getInfoData, GetInfoResponse, setGptDeployment, stopStream, UserData
} from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { SettingsButton } from "../../components/SettingsButton";
import { PromptSettingsButton } from "../../components/PromptSettingsButton"
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

const Chat = () => {
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
    const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);
    const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);
    const [promptTemplate, setPromptTemplate] = useState<string>("");
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
    const [selectedGptDeployment, setSelectedGptDeployment] = useState<string | undefined>(undefined);

    const userContext = useContext(UserContext);
    const userData = userContext?.userData as UserData;
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    
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
                        prompt_template: promptTemplate.length === 0 ? undefined : promptTemplate,
                        suggest_followup_questions: useSuggestFollowupQuestions,
                        user_persona: userPersona,
                        system_persona: systemPersona,
                        ai_persona: aiPersona,
                        response_length: responseLength,
                        top_p: topP,
                        selected_folders: selectedFolders.length == 0 ? "All" : selectedFolders.join(","),
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

    const onPromptTemplateChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setPromptTemplate(newValue || "");
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

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);
    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);
    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "auto" }), [streamedAnswers]);
    useEffect(() => setIsAdmin(userData?.is_admin), [userData]);

    useEffect(() => {
        getInfoData()
            .then((response: GetInfoResponse) => {
                setSelectedGptDeployment(response.AZURE_OPENAI_CHATGPT_DEPLOYMENT);
            })
            .catch(err => console.log(err.message));

        getGptDeployments()
            .then(setAllGptDeployments)
            .catch(err => console.log(err.message));
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading || isStreaming} />
                <PromptSettingsButton className={styles.commandButton} onClick={() => setIsPromptPanelOpen(!isPromptPanelOpen)} disabled={isLoading || isStreaming} />
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
                            onAdjustClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
                            onInfoClick={() => setIsInfoPanelOpen(!isInfoPanelOpen)}
                            clearChatDisabled={!lastQuestionRef.current || isLoading || isStreaming}
                            onClearClick={clearChat}
                            onRegenerateClick={() => makeApiRequest(lastQuestionRef.current)}
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
                    headerText="Prompt Settings"
                    isOpen={isPromptPanelOpen}
                    isBlocking={true}
                    onDismiss={() => setIsPromptPanelOpen(false)}
                    closeButtonAriaLabel="Close"
                    onRenderFooterContent={() => <DefaultButton onClick={() => setIsPromptPanelOpen(false)}>Close</DefaultButton>}
                    isFooterAtBottom={true}>
                    <PromptOverride className={styles.chatSettingsSeparator} defaultValue={promptTemplate} onChange={onPromptTemplateChange} />
                </Panel>
                <Panel
                    type={PanelType.smallFixedFar}
                    headerText="Configure answer generation"
                    isOpen={isConfigPanelOpen}
                    isBlocking={true}
                    onDismiss={() => setIsConfigPanelOpen(false)}
                    closeButtonAriaLabel="Close"
                    onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>Close</DefaultButton>}
                    isFooterAtBottom={true}>
                    {selectedGptDeployment && (
                        <ModelPicker
                            className={styles.chatSettingsSeparator}
                            deployments={allGptDeployments}
                            selectedGptDeployment={selectedGptDeployment}
                            onGptDeploymentChange={onGptDeploymentChange}
                        />
                    )}
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
                    <TextField className={styles.chatSettingsSeparator} defaultValue={userPersona} label="User Persona" onChange={onUserPersonaChange} />
                    <TextField className={styles.chatSettingsSeparator} defaultValue={systemPersona} label="System Persona" onChange={onSystemPersonaChange} />
                    <ResponseLengthButtonGroup className={styles.chatSettingsSeparator} onClick={onResponseLengthChange} defaultValue={responseLength} />
                    <ResponseTempSlider className={styles.chatSettingsSeparator} onChange={setResponseTemp} value={responseTemp} />
                    <TopPSlider className={styles.chatSettingsSeparator} onChange={setTopP} value={topP} />
                    <Separator className={styles.chatSettingsSeparator}>Filter Search Results</Separator>
                    <FolderPicker allowFolderCreation={false} onSelectedKeyChange={onSelectedKeyChanged} selectedKeys={selectedFolders} userData={userData} />
                    <TagPickerInline allowNewTags={false} onSelectedTagsChange={onSelectedTagsChange} preSelectedTags={selectedTags} />
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