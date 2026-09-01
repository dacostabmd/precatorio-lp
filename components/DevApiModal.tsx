'use client';

import React, { useState } from 'react';
import { ResultadoConsultaInfoSimples } from '@/lib/infosimples';

interface DevApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiData: ResultadoConsultaInfoSimples | null;
  leadNome?: string;
  leadCpf?: string;
  leadTelefone?: string;
  bitrixDealId?: number | null;
}

export default function DevApiModal({
  isOpen,
  onClose,
  apiData,
  leadNome,
  leadCpf,
  leadTelefone,
  bitrixDealId,
}: DevApiModalProps) {
  const [activeTab, setActiveTab] = useState<'resumo' | 'processos' | 'tribunais' | 'raw'>('resumo');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(apiData || {}, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalTribunais = apiData?.detalhesPorTribunal?.length || 0;
  const tribunaisComSucesso = apiData?.detalhesPorTribunal?.filter((t) => t.encontrouDados).length || 0;
  const restricoesCount = apiData?.restricoes?.length || 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 15, 29, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          border: '1px solid #1E293B',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#1E293B',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              DEV AMBIENTE
            </span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#F1F5F9' }}>
              🔍 Dados Extraídos da API InfoSimples
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
            title="Fechar Modal"
          >
            ✕
          </button>
        </div>

        {/* Lead Info Bar */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#141E33',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '13px',
          }}
        >
          <div>
            <span style={{ color: '#64748B' }}>Nome: </span>
            <strong style={{ color: '#E2E8F0' }}>{leadNome || 'Não informado'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748B' }}>CPF: </span>
            <strong style={{ color: '#38BDF8', fontFamily: 'monospace' }}>{leadCpf || apiData?.cpf || '–'}</strong>
          </div>
          {leadTelefone && (
            <div>
              <span style={{ color: '#64748B' }}>WhatsApp / Tel: </span>
              <strong style={{ color: '#A78BFA', fontFamily: 'monospace' }}>{leadTelefone}</strong>
            </div>
          )}
          {bitrixDealId && (
            <div>
              <span style={{ color: '#64748B' }}>Bitrix Deal: </span>
              <strong style={{ color: '#34D399' }}>#{bitrixDealId}</strong>
            </div>
          )}
          <div>
            <span style={{ color: '#64748B' }}>Tempo API: </span>
            <strong style={{ color: '#FCD34D' }}>{apiData?.tempoTotalMs ? `${(apiData.tempoTotalMs / 1000).toFixed(1)}s` : '–'}</strong>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#0F172A',
            borderBottom: '1px solid #1E293B',
            padding: '0 16px',
          }}
        >
          {[
            { id: 'resumo', label: '📊 Resumo Geral' },
            { id: 'processos', label: `🎯 Processos (${apiData?.totalProcessos || 0})` },
            { id: 'tribunais', label: `🏛️ Tribunais (${totalTribunais})` },
            { id: 'raw', label: '⚡ JSON Bruto' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? 600 : 500,
                color: activeTab === tab.id ? '#38BDF8' : '#94A3B8',
                borderBottom: activeTab === tab.id ? '2px solid #38BDF8' : '2px solid transparent',
                background: 'none',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          {!apiData || !apiData.executado ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8' }}>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#E2E8F0', marginBottom: '8px' }}>
                Nenhuma consulta registrada ainda
              </p>
              <p style={{ fontSize: '13px' }}>
                Os dados da API InfoSimples serão exibidos aqui assim que o CPF for submetido no fluxo.
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: RESUMO */}
              {activeTab === 'resumo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Status Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#1E293B',
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid #334155',
                      }}
                    >
                      <div style={{ color: '#94A3B8', fontSize: '12px', marginBottom: '4px' }}>
                        Processos Identificados
                      </div>
                      <div
                        style={{
                          fontSize: '24px',
                          fontWeight: 700,
                          color: apiData.totalProcessos > 0 ? '#34D399' : '#94A3B8',
                        }}
                      >
                        {apiData.totalProcessos}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                        Localizados em bases públicas
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: '#1E293B',
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid #334155',
                      }}
                    >
                      <div style={{ color: '#94A3B8', fontSize: '12px', marginBottom: '4px' }}>
                        Tribunais com Restrição / Segredo
                      </div>
                      <div
                        style={{
                          fontSize: '24px',
                          fontWeight: 700,
                          color: restricoesCount > 0 ? '#F59E0B' : '#94A3B8',
                        }}
                      >
                        {restricoesCount}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                        Peças restritas / Segredo de justiça
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: '#1E293B',
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid #334155',
                      }}
                    >
                      <div style={{ color: '#94A3B8', fontSize: '12px', marginBottom: '4px' }}>
                        Tribunais Consultados
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#38BDF8' }}>
                        {totalTribunais}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                        TRFs e TJs em paralelo
                      </div>
                    </div>
                  </div>

                  {/* Restrições Highlight */}
                  {apiData.restricoes && apiData.restricoes.length > 0 && (
                    <div
                      style={{
                        backgroundColor: '#451A03',
                        border: '1px solid #78350F',
                        borderRadius: '10px',
                        padding: '14px 16px',
                      }}
                    >
                      <div
                        style={{
                          color: '#FBBF24',
                          fontWeight: 600,
                          fontSize: '13px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        ⚠️ Detalhe de Processo com Acesso Restrito:
                      </div>
                      {apiData.restricoes.map((r, i) => (
                        <div key={i} style={{ color: '#FDE68A', fontSize: '13px' }}>
                          • <strong>{r.tribunal}:</strong> {r.detalhe}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Envio ao Bitrix Status */}
                  <div
                    style={{
                      backgroundColor: '#1E293B',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      border: '1px solid #334155',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#E2E8F0', marginBottom: '8px', fontSize: '13px' }}>
                      🏢 Integração Bitrix24
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                      Os dados retornados desta consulta foram formatados e gravados automaticamente no card do lead (Deal{' '}
                      <strong style={{ color: '#34D399' }}>#{bitrixDealId || 'criado'}</strong>) no campo de comentários e nos campos customizados de CPF.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: PROCESSOS */}
              {activeTab === 'processos' && (
                <div>
                  {apiData.processos && apiData.processos.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {apiData.processos.map((proc, idx) => (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: '#1E293B',
                            borderRadius: '12px',
                            padding: '16px 18px',
                            border: proc.isPrecatorio ? '1.5px solid #059669' : '1px solid #334155',
                            boxShadow: proc.isPrecatorio ? '0 0 15px rgba(5, 150, 105, 0.2)' : 'none',
                          }}
                        >
                          {/* Header do Processo */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '12px',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  backgroundColor: '#0284C7',
                                  color: '#FFFFFF',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: '5px',
                                }}
                              >
                                {proc.tribunal}
                              </span>
                              {proc.isPrecatorio && (
                                <span
                                  style={{
                                    backgroundColor: '#059669',
                                    color: '#FFFFFF',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  ⭐ PRECATÓRIO / CRÉDITO PÚBLICO
                                </span>
                              )}
                            </div>

                            <span
                              style={{
                                fontFamily: 'Consolas, Monaco, monospace',
                                fontWeight: 700,
                                fontSize: '15px',
                                color: '#38BDF8',
                                backgroundColor: '#0F172A',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid #1E293B',
                              }}
                            >
                              {proc.numeroProcesso || 'Sem número identificado'}
                            </span>
                          </div>

                          {/* Grid de Detalhes */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                              gap: '10px',
                              fontSize: '13px',
                              backgroundColor: '#141E33',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #1E293B',
                            }}
                          >
                            {proc.classe && (
                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>CLASSE</span>
                                <strong style={{ color: '#E2E8F0' }}>{proc.classe}</strong>
                              </div>
                            )}
                            {proc.assunto && (
                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>ASSUNTO</span>
                                <strong style={{ color: '#E2E8F0' }}>{proc.assunto}</strong>
                              </div>
                            )}
                            {proc.vara && (
                              <div style={{ gridColumn: 'span 2' }}>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>VARA / FORO</span>
                                <strong style={{ color: '#E2E8F0' }}>{proc.vara}</strong>
                              </div>
                            )}
                            {proc.valorCausa && (
                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>VALOR DA CAUSA</span>
                                <strong style={{ color: '#34D399', fontSize: '15px' }}>{proc.valorCausa}</strong>
                              </div>
                            )}
                            {proc.exequente && (
                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>EXEQUENTE / AUTOR</span>
                                <span style={{ color: '#E2E8F0' }}>{proc.exequente}</span>
                              </div>
                            )}
                            {proc.executado && (
                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>EXECUTADO / RÉU</span>
                                <strong style={{ color: '#F87171' }}>{proc.executado}</strong>
                              </div>
                            )}
                          </div>

                          {/* Última Movimentação */}
                          {proc.ultimaMovimentacao && (
                            <div
                              style={{
                                marginTop: '10px',
                                backgroundColor: '#0B132B',
                                borderLeft: '3px solid #38BDF8',
                                padding: '8px 12px',
                                borderRadius: '0 6px 6px 0',
                                fontSize: '12px',
                              }}
                            >
                              <span style={{ color: '#94A3B8', fontWeight: 600 }}>
                                📌 Última Movimentação {proc.ultimaMovimentacao.data ? `(${proc.ultimaMovimentacao.data})` : ''}:
                              </span>{' '}
                              <span style={{ color: '#CBD5E1' }}>{proc.ultimaMovimentacao.movimento}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8' }}>
                      <p style={{ fontSize: '15px', color: '#E2E8F0', marginBottom: '6px' }}>
                        Nenhum processo público listado
                      </p>
                      <p style={{ fontSize: '13px' }}>
                        Os tribunais consultados não retornaram processos abertos para este CPF (ou constam sob acesso restrito).
                      </p>
                    </div>
                  )}
                </div>
              )}


              {/* TAB 3: TRIBUNAIS */}
              {activeTab === 'tribunais' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {apiData.detalhesPorTribunal?.map((trib, idx) => {
                    const isSuccess = trib.encontrouDados;
                    const isRestricted = trib.code === 620;
                    const isNotFound = trib.code === 612;

                    return (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#1E293B',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          border: '1px solid #334155',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: '#F1F5F9' }}>{trib.tribunal}</span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: isSuccess
                                ? '#059669'
                                : isRestricted
                                ? '#D97706'
                                : isNotFound
                                ? '#475569'
                                : '#DC2626',
                              color: '#FFFFFF',
                            }}
                          >
                            {isSuccess
                              ? 'Processo Encontrado'
                              : isRestricted
                              ? 'Peça Restrita'
                              : isNotFound
                              ? '0 Registros'
                              : `Código ${trib.code}`}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                          Endpoint: <code style={{ color: '#38BDF8' }}>{trib.slug}</code> · Tempo: {trib.tempoMs}ms
                        </div>
                        {trib.erros && trib.erros.length > 0 && (
                          <div style={{ fontSize: '12px', color: '#F87171' }}>
                            Mensagem: {trib.erros.join(' · ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 4: RAW JSON */}
              {activeTab === 'raw' && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginBottom: '8px',
                    }}
                  >
                    <button
                      onClick={handleCopyJson}
                      style={{
                        backgroundColor: copied ? '#059669' : '#334155',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      {copied ? '✓ JSON Copiado!' : '📋 Copiar JSON'}
                    </button>
                  </div>
                  <pre
                    style={{
                      backgroundColor: '#050B14',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid #1E293B',
                      color: '#38BDF8',
                      fontSize: '12px',
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      overflowX: 'auto',
                      maxHeight: '400px',
                    }}
                  >
                    {JSON.stringify(apiData, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#1E293B',
            borderTop: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            Visível apenas em ambiente de desenvolvimento (`NODE_ENV === &apos;development&apos;`)
          </span>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#3B82F6',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
